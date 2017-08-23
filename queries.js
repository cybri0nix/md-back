var promise = require('bluebird')

/**
 * 	@TODO
 * 	- moment to global
 *  - Code optimizations
 *  - Modulization
 *  - Improove errors handling
 *  - ORM + parametrize queries (if time will enough)
 *  - Infrastructure for dev/prod
 *  - Styleguides
 *  - Explain queries + indexes + fk constraints
 *  - Caching results in memory or SSD
 *  - Logs
 */

var pgp = require('pg-promise')({
	promiseLib: promise
})
var connectionString = global.consts.DB_CONNECTION_STRING
var db = pgp(connectionString)

module.exports = {
	getEvents: getEvents,
	getEvent: getEvent,
	getDaysEvents: getDaysEvents,
	getCountEvents: getCountEvents,
	__install: __install
}

var Months = [
	'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
]


const DEFAULT_ITEMS_PER_PAGE = 10

const EVENTS_LIST_COLUMNS = [
	'e.id', 		// int
	'e.begin_time', 		// 2017-07-08 12:20:00
	'e.title title', 	// character varaying
	'e.location_title', 	// character varaying
	'e.description', 		// text
	'e.lng', 				// real
	'e.lat', 				// real
	'e.favs_count', 		// int
	'e.is_main', 			// bool
	'e.is_bold', 			// bool
	'e.is_free',
	'e.address',
	'e.end_time',
	'e.restriction',
	'p.title place_title', 	// character varaying
	'p.id place_id'		// int
]

const EVENT_COLUMNS = EVENTS_LIST_COLUMNS



function getEvents(req, res, next) {

	var params = []
	var q = {
		'columns': EVENTS_LIST_COLUMNS,
		'from': [
			'events e',
			'places p'
		],
		'where': [
			'e.place_id = p.id'
		],
		'orderby': [
			'e.begin_time ASC'
		],
		'limit': -1,
		'offset': -1
	}

	var pageNum = ~~req.query.page
	var itemsPerPage = ~~req.query.items_per_page || DEFAULT_ITEMS_PER_PAGE
	var orderByCol = req.query.orderby_col
	var orderByMode = req.query.orderby_mode

	var categoryId = ~~req.query.category

	var appId = req.query.app_id
	var appData = req.query.app_data
	var appDataFixDate

	var date = req.query.date
	var isMain = req.query.is_main

	var placeId = ~~req.query.place

	// Filter date
	if (date) {
		var dateChunks = date.split('-')
		dateChunks.forEach((chunk, i) => {
			dateChunks[i] = i > 0 ? "0".concat(~~chunk).slice(-2) : ~~chunk
		})
		date = dateChunks.join('-')
	}

	// @todo: improve
	if (q['columns'].indexOf('e2c.category_id') !== -1) {
		a['columns'] = a['columns'].filter(function (item) {
			return item !== 'e2c.category_id'
		})
	}

	if (categoryId) {
		q['from'].push('event_to_cats e2c')
		q['where'].push('e.id = e2c.event_id')
		q['where'].push(['e2c.category_id', categoryId].join('='))
	}

	if (placeId) {
		q['where'].push(['e.place_id', placeId].join('='))
	}

	if (isMain) {
		q['where'].push(['e.is_main', isMain].join('='))
	}

	if (date) {
		q['date'] = date
	}

	// Setting pagination
	if (itemsPerPage) {
		q['limit'] = itemsPerPage
	}
	if (pageNum) {
		q['offset'] = (pageNum - 1) * itemsPerPage
	}

	if (q['date']) {
		var date = new Date(q['date'])
		var filterByDate = [
			date.getUTCFullYear(),
			"0".concat(date.getUTCMonth() + 1).slice(-2),
			"0".concat(date.getUTCDate()).slice(-2)
		].join('-')

		// @TODO: refactoring required for selecting between begin_time and end_time
		// q['where'].push(`e.begin_time >='${filterByDate} 00:00'`)
		// q['where'].push(`e.begin_time <='${filterByDate} 23:59'`)

		// After first refactoring:
		// it is not enough 
		// q['where'].push(`'${filterByDate}' BETWEEN e.begin_time AND e.end_time`)	

		// After second refactoring:
		q['where'].push(`('${filterByDate}'
			BETWEEN 
						concat(to_char(e.begin_time, 'YYYY-MM-DD'), ' 00:00')::date AND concat(to_char(e.end_time, 'YYYY-MM-DD'), ' 23:59')::date
				)`)
	}

	// Constructing query string
	var qs = [
		'SELECT', 'DISTINCT ' + q['columns'].join(', '),
		'FROM', q['from'].join(', '),
		'WHERE', q['where'].join(' AND '),
		'ORDER BY e.begin_time ASC'
	]

	if (q['limit'] > 0) {
		qs.push(['LIMIT', q['limit']].join(' '))
	}

	if (q['offset'] > 0) {
		qs.push(['OFFSET', q['offset']].join(' '))
	}

	if (!global.consts.PRODUCTION) {
		console.log('\n_______________________________________________\n')
		console.log('METHOD:\n getEvents')
		console.log('QUERY:\n selecting events:\n', qs.join(' '))
	}

	db.any(qs.join(' '))
		.then(eventsList => {

			if (eventsList.length === 0) {
				responseSuccess(res, {
					code: 200,
					data: []
				})
				return
			}

			var eventsIDs = []
			var eventId2IndexMap = {}
			var time
			var dt

			// Setting up events IDs map and formatting date
			var i
			for (i in eventsList) {
				eventsIDs.push(eventsList[i].id) // for getting cats query
				eventId2IndexMap[eventsList[i].id] = i // for saving order

				dt = new Date(eventsList[i].begin_time)
				time = [
					'0'.concat(dt.getHours()).slice(-2),
					'0'.concat(dt.getMinutes()).slice(-2)
				].join(':')

				eventsList[i].dateFormatted = {
					day: dt.getDate(),
					month: Months[dt.getMonth()],
					time: time,
				}
			}

			var qCats = [
				'SELECT e2c.event_id, c.id cat_id, c.icon_name icon_name, c.title cat_title',
				'FROM categories c, event_to_cats e2c',
				'WHERE',
				[
					'e2c.category_id = c.id',
					'e2c.event_id IN (' + eventsIDs.join(',') + ')'
				].join(' AND ')
			]

			if (!global.consts.PRODUCTION) {
				console.log('QUERY2:\n selecting categories by events IDs:\n', qCats.join(' '))
			}

			// Selecting cats by events IDs
			db.any(qCats.join(' '))
				.then(cats => {

					var eventIdx

					// Injecting categorie data to events
					for (var i in cats) {

						eventIdx = eventId2IndexMap[cats[i].event_id]

						if (undefined === eventsList[eventIdx]['categories']) {
							eventsList[eventIdx]['categories'] = []
						}

						eventsList[eventIdx]['categories'].push({
							'id': cats[i].cat_id,
							'title': cats[i].cat_title,
							'icon_name': cats[i].icon_name
						})
					}

					if (!global.consts.PRODUCTION) {
						console.log('events returned:\n', eventsList)
						console.log('\n_______________________________________________\n')
					}

					responseSuccess(res, {
						code: 200,
						data: eventsList
					})

				})
				.catch(err => {
					responseError(res, {
						code: 404,
						err: err
					})
				})
		})
		.catch(err => {
			responseError(res, {
				code: 404,
				err: err
			})
		})
}



function getEvent(req, res, next) {
	var id = parseInt(req.params.id)

	var q = [
		'SELECT', EVENT_COLUMNS.join(),
		'FROM', 'events e, places p',
		'WHERE',
		[
			'e.id = ' + id,
			'p.id = e.place_id'
		].join(' AND ')
	]

	console.log('_______________________________________________')
	console.log('METHOD: getEvent')
	console.log('QUERY: ', q.join(' '))
	console.log('_______________________________________________')

	db.one(q.join(' '))
		.then(data => {
			if (data.begin_time !== undefined) {
				const dt = new Date(data.begin_time)
				const time = [
					'0'.concat(dt.getHours()).slice(-2),
					'0'.concat(dt.getMinutes()).slice(-2)
				].join(':')

				data.dateFormatted = {
					day: dt.getDate(),
					month: Months[dt.getMonth()],
					time: time,
				}
			}

			responseSuccess(res, {
				code: 200,
				data: data
			})
		})
		.catch(err => {

			if (err.name === 'QueryResultError'
				&& err.result.rowCount === 0) {
				responseError(res, {
					code: 404,
					err: {
						"code": -1000,
						"message": "event not found"
					}
				})
				return
			}
			responseError(res, {
				code: 404,
				err: err
			})
		})
}




function getDaysEvents(req, res, next) {

	let placeId = ~~req.query.place
	let categoryId = ~~req.query.category

	if (!placeId && !categoryId) {
		responseError(res, {
			code: 404
		})
		return
	}

	let from = ['events e']
	let where = []

	const today = new Date()
	const filterByDate = {
		'year': today.getFullYear(),
		'month': "0".concat(today.getMonth() + 1).slice(-2),
		'day': "0".concat(today.getDate()).slice(-2)
	}

	if (categoryId) {
		from.push('event_to_cats e2c')
		where.push('e.id = e2c.event_id')
		where.push('e2c.category_id=' + categoryId)
	} else {
		where.push('e.place_id=' + placeId)
	}

	const q = [
		'SELECT',
		[
			'EXTRACT(DAY FROM e.begin_time) d',
			'EXTRACT(YEAR FROM e.begin_time) y',
			'EXTRACT(MONTH FROM e.begin_time) m',
			'count(*) count'
		].join(', '),
		'FROM', from.join(', '),
		'WHERE', where.join(' AND '),
		'GROUP BY y,m,d',
		'ORDER BY m,d'
	]

	console.log('getDaysEvents: ', q.join(' '))

	db.any(q.join(' '))
		.then(dates => {

			let dt
			let time
			const newDates = []
			let buffDate

			for (let i in dates) {

				if (~~dates[i].m === ~~filterByDate.month) {
					if (~~dates[i].d < ~~filterByDate.day) {
						continue
					}
				}
				else if (~~dates[i].m < ~~filterByDate.month || ~~dates[i].y < ~~filterByDate.year) {
					continue
				}

				buffDate = dates[i]

				// Concat date from [y], [m], [d] => [y-m-d]
				buffDate.dt = [
					dates[i].y,
					"0".concat(buffDate.m).slice(-2),
					"0".concat(buffDate.d).slice(-2)
				].join('-')

				delete buffDate.y
				delete buffDate.m
				delete buffDate.d

				// Add formattedDate
				dt = new Date(buffDate.dt)
				time = [
					'0'.concat(dt.getHours()).slice(-2),
					'0'.concat(dt.getMinutes()).slice(-2)
				].join(':')

				buffDate.dateFormatted = {
					day: dt.getDate(),
					month: Months[dt.getMonth()],
					time: time,
				}

				newDates.push(buffDate)
			}

			responseSuccess(res, {
				code: 200,
				data: newDates
			})
		})
		.catch(err => {
			responseError(res, {
				code: 404,
				err: err
			})
		})
}





function getCountEvents(req, res, next) {

	var type = req.query.type

	if (!type || -1 === ['byplaces', 'bycategories'].indexOf(type)) {
		res.status(404)
			.json({
				code: 404
			})
		return
	}

	const columns = []
	const from = []
	const where = []
	const groupby = []

	const today = new Date()
	const filterByDate = [
		today.getFullYear(),
		'0'.concat(today.getMonth() + 1).slice(-2),
		'0'.concat(today.getDate()).slice(-2),
	].join('-')

	switch (type) {

		case 'bycategories':

			// SELECT c.id, c.title, c.order_priority, c.icon_name, count(distinct e.id) events_count 
			// FROM event_to_cats e2c, categories c, events e
			// WHERE
			// e2c.category_id = c.id AND e2c.event_id = e.id
			// AND ('2017-08-23' BETWEEN e.begin_time AND e.end_time OR e.begin_time >= '2017-08-23')

			// GROUP BY c.id 
			// ORDER BY order_priority DESC

			columns.push('c.id', 'c.title', 'c.order_priority', 'c.icon_name', 'count(distinct e.id) events_count')
			from.push('event_to_cats e2c, categories c, events e')
			where.push('e2c.category_id = c.id')
			where.push('e2c.event_id = e.id')
			where.push(`('${filterByDate}' BETWEEN e.begin_time AND e.end_time OR e.begin_time >= '${filterByDate}')`)
			groupby.push('c.id')
			break

		case 'byplaces':
			// @TODO: refactor: add filtering by today, exclude left joins
			columns.push('p.id', 'p.title', 'p.order_priority', 'count(e.id) events_count')
			from.push('places p LEFT JOIN events e ON e.place_id = p.id')
			//where.push('e.place_id = p.id')
			groupby.push('p.id')
			break
	}


	var q = [
		'SELECT', columns.join(', '),
		'FROM', from.join(', '),
		(where.length ? 'WHERE ' + where.join(' AND ') : ''),
		'GROUP BY', groupby.join(', '),
		'ORDER BY order_priority DESC'
	]


	console.log('q: ', q.join(' '))

	db.any(q.join(' '))
		.then(data => {
			responseSuccess(res, {
				code: 200,
				data: data
			})
		})
		.catch(err => {
			responseError(res, {
				code: 404,
				err: err
			})
		})
}



function responseSuccess(res, response) {
	res.status(200).setHeader('Content-Type', 'application/json')
	res.json(response)
}

function responseError(res, response) {
	res.status(404).setHeader('Content-Type', 'application/json')
	res.json(response)
}


function __install(req, res, next) {

}







