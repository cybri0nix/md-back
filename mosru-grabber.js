const request = require("request")
const fs = require('fs');
const moment = require('moment')
const promisify = require("es6-promisify");
const { Client } = require('pg')

const HOST = 'http://mos.ru'

const getEventsUrl = (page) => {
	return `${HOST}/api/newsfeed/v4/frontend/json/ru/events?`
		+ [
			'fields=id,title,image,occurrence_id,sphere,date_timestamp,date_from_timestamp,date_to_timestamp',
			'from=2017-08-17+00:00:00',
			'per-page=24',
			`page=${page}`,
			'sphere_id=167299',/* tag: День города */
			'to=2017-09-17+23:59:59'
		].join('&')
}



const getEventUrl = (eventId) => {
	return `${HOST}/api/newsfeed/v4/frontend/json/ru/events/${eventId}`
}

const pages = [8, 7, 6, 5, 4, 3, 2, 1]
let gFormattedEvents = []
let gEventsIDs = []
let sql = []
let buffResponse = []


let requireCategory = []
let placesDump = {}

const pg = new Client()

const write = (content, filename) => {
	fs.writeFile(`./${filename}`, content, function (err) {
		if (err) {
			return console.log(err);
		}

		console.log("The file was saved!");
	});
}


const downloadImage = (_uri, eventId, size) => {

	const uri = HOST + _uri
	const filename = `./images/events/${eventId}_${size}.jpg`

	return new Promise((resolve, reject) => {
		if (fs.existsSync(filename)) {
			resolve()
		} else {
			request.head(uri, function (err, res, body) {
				if (err) {
					reject(err)
				} else {
					request(uri)
						.pipe(fs.createWriteStream(filename)).on('close', () => {
							resolve()
						})
				}
			})
		}
	})
}

const insertPlace = () => {

}

const quoteize = (str) => {
	return "'".concat(str).concat("'")
}

var escapeString = (val) => {
	val = val.replace(/[\0\n\r\b\t\\'"\x1a]/g, function (s) {
		switch (s) {
			case "\0":
				return "\\0";
			case "\n":
				return "\\n";
			case "\r":
				return "\\r";
			case "\b":
				return "\\b";
			case "\t":
				return "\\t";
			case "\x1a":
				return "\\Z";
			case "'":
				return "''";
			case '"':
				return '""';
			default:
				return "\\" + s;
		}
	});

	return val;
};

const getInsertSQL = (type, eventData) => {
	switch (type) {
		case 'event':
			const cols = [
				'id',
				'mos_id',
				'title',
				'begin_time',
				'end_time',
				'description',
				'location_title',
				'lat',
				'lng',
				'place_id',
				'address',
				'restriction',
				'is_free',
				'is_main',
				'is_bold',
				'favs_count',].join(', ')

			let values = []

			for (let k in eventData) {
				if (typeof (eventData[k]) == 'string') {
					eventData[k] = quoteize(escapeString(eventData[k]))
				}
				values.push(eventData[k])
			}

			values = values.join(', ')

			return "INSERT INTO events(" + cols + ") VALUES(" + values + ");"

			break
	}
}

const shortEventsList = []

const downloadPage = (page, afterDownloadComplete) => {

	console.log('Downloading page: ', page)

	request({
		url: getEventsUrl(page),
		json: true
	}, function (error, response, body) {

		if (error) {
			console.log(error)
			return
		}

		if (!error && response.statusCode === 200) {
			// Grab events list and prepare IDs
			body.items.map((item) => {

				gEventsIDs.push({
					id: item.id,
					occurrence: item.occurrence_id
				})

				shortEventsList.push(JSON.stringify(item))
			})

			if (currPage >= body._meta.pageCount) {
				console.log('\n\nAll pages downloaded!\n\n')
				console.log('\n\n EVENTS COUNT: ' + gEventsIDs.length + ' \n\n')

				write('[' + shortEventsList.join(',\n') + ']', '.responseAllEvents')

				afterDownloadComplete()
			} else {
				downloadPage(++currPage, afterDownloadComplete)
			}
		}
	})
}

const downloadEvent = (eventId, occurrence) => {
	request(
		{
			url: getEventUrl(eventId) + (occurrence ? '/' + occurrence : ''),
			json: true
		},
		function (error, response, body) {
			if (error) {
				console.log(error)
				return
			}

			if (!error && response.statusCode === 200) {

				let skip = false
				
				skip = body.address ? skip : true
				skip = body.address && !body.address.lat ? true : skip

				if (skip) {
					console.log('\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-')
					console.log(`Event ${body.id} skiped. Some required fields is null!`)
					console.log('\n+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-')
					const nextEvent = gEventsIDs.pop()
					console.log('\n\n---------------------------------------------')
					console.log('\n\n\n          Trying downloading next event (' + gEventsIDs.length + ' left): ' + nextEvent.id)
					console.log('\n\n---------------------------------------------\n\n')
					downloadEvent(nextEvent.id, nextEvent.occurrence)

					write('https://www.mos.ru/calendar/event/35083088/' + body.id + '\n', './smthNullList')
					return
				}

				const place = {
					title: '',
					order_priority: 0,
				}

				if (body.place) {
					place.title = `'${body.place.title}'`
					place.order_priority = 0

					placesDump[body.place.id] = body.place.title
				}

				// @tood: get last inserted place ID and assign to event.place_id
				const placeId = 1


				// Format to timestamp
				const beginTimestamp = moment(body.date_from_timestamp * 1000)
					.utc()
					.utcOffset('+03:00')
					.format('YYYY-MM-DD HH:mm')

				const endTimestamp = moment(body.date_to_timestamp * 1000)
					.utc()
					.utcOffset('+03:00')
					.format('YYYY-MM-DD HH:mm')

				let restriction = ''

				if (body.info && body.info.restriction) {
					restriction = body.info.restriction.age
				}


				const event = {
					id: body.id + (occurrence ? occurrence : 0),
					mos_id: body.id,
					title: body.title,
					begin_time: beginTimestamp,
					end_time: endTimestamp,
					description: body.text,
					location_title: body.place ? body.place.title : body.address.title,
					lat: parseFloat(body.address.lat),
					lng: parseFloat(body.address.lon),
					place_id: placeId,
					address: body.address.title,
					restriction: restriction,
					is_free: ~~body.free,
					is_main: 0,
					is_bold: 0,
					favs_count: 0,
				}

				// 
				requireCategory.push(`${body.title}, see here: https://www.mos.ru/calendar/event/${body.id}`)

				//
				gFormattedEvents.push(event)

				//
				buffResponse.push(JSON.stringify(body))

				//
				console.log('\n\nDownloading images for event: ', body.id)

				if (body.image && body.image.length) {
					console.log('downloading small')
					downloadImage(body.image[0].small.src, event.id, 'small')
						.then(() => {
							console.log('downloading large')
							downloadImage(body.image[0].middle.src, event.id, 'large')
								.then(() => {
									console.log('Images downloaded successfull!')

									// Download next
									if (0 === gEventsIDs.length) {

										console.log('\n\n=================================\n\n')
										console.log('          EVENTS DOWNLOADING FINISHED!!!')
										console.log('\n\n=================================\n\n')

										gFormattedEvents.map((event) => {
											const insertSQL = getInsertSQL('event', event)
											sql.push(insertSQL)
										})

										write(sql.join('\n\n'), 'sqlEvents')
										write(requireCategory.join('\n\n'), 'assignCats')
										write(JSON.stringify(placesDump), 'placesDump')
										write('[' + buffResponse.join(',\n') + ']', 'responseItems')

									} else {
										// setTimeout(() => {
										const nextEvent = gEventsIDs.pop()
										console.log('\n\n---------------------------------------------')
										console.log('\n\n\n          Trying downloading next event (' + gEventsIDs.length + ' left): ' + nextEvent.id)
										console.log('\n\n---------------------------------------------\n\n')
										downloadEvent(nextEvent.id, nextEvent.occurrence)
										// }, ~~(Math.random() * 3000) + 1000 )
									}
								})
						})
				}
			}
		}
	)
}



let currPage = 1

console.log('\n\n===================== LEST GRAB EVENTS FROM MOS.RU =====================\n\n')
console.log('Getting list of events...')

downloadPage(currPage, () => {
	const nextEvent = gEventsIDs.pop()
	console.log('\n\nWe have All events IDs now! ;)\n\n')
	console.log('\n\n===================== Start downloading first event: ' + nextEvent.id + '=====================')
	downloadEvent(nextEvent.id, nextEvent.occurrence)
})
