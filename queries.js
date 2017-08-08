var promise = require('bluebird');


// host:port/user@password
// host:port/user (if no password)
const DB_QUERY_STRING = 'postgres://localhost:5432/a1';




var options = {
  // Initialization Options
  promiseLib: promise
};

var pgp = require('pg-promise')(options);
var connectionString = DB_QUERY_STRING;
var db = pgp(connectionString);

// add query functions

module.exports = {
	getEvents: getEvents,
	getEvent: getEvent,
	getDaysEvents: getDaysEvents,
	getCountEvents: getCountEvents,
	__install: __install
};


const ITEMS_PER_PAGE = 10;

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
	'e.photo',				// character varaying
	'p.title place_title', 	// character varaying
	'p.id place_id'		// int
	//'c.id category_id',		// int
    //'c.title category_title'// character varaying 
]

const EVENT_COLUMNS = EVENTS_LIST_COLUMNS;



function getEvents(req, res, next) {

	let params = []
	let q = {
			'columns': EVENTS_LIST_COLUMNS,
			'from':[
				'events e', 
				'places p'
			],
			'where': [
				'e.place_id = p.id'
				//'e.id = e2c.event_id', 
				//'c.id = e2c.category_id'
			],
			'orderby': [
				'e.begin_time ASC'
			],
			'limit': -1,
			'offset': -1
		};

	let pageNum = ~~req.query.page
	let itemsPerPage = ~~req.query.items_per_page || ITEMS_PER_PAGE
	let orderByCol = req.query.orderby_col
	let orderByMode = req.query.orderby_mode

	let categoryId = ~~req.query.category

	let appId = req.query.app_id;
	let appData = req.query.app_data;
	let appDataFixDate

	let date = req.query.date
	let isMain = req.query.is_main

	let placeId = ~~req.query.place

	// govnocode/kostyl/vasya
	if (q['columns'].indexOf('e2c.category_id') !== -1) {
		a['columns'] = a['columns'].filter(function(item) { 
			return item !== 'e2c.category_id'
		})
	}

	if (categoryId) {
		q['from'].push('event2cats e2c');
		q['where'].push('e.id = e2c.event_id');
		q['where'].push(['e2c.category_id', categoryId].join('='));
	}

	if (placeId) {
		q['where'].push(['e.place_id', placeId].join('='));
	}

	// Setting 'where' conditions
	/*for (let p in params) {
		if (params[p]) {
			q['where'].push([p, params[p]].join('='));
		}
	}*/

	if (undefined !== isMain) {
		q['where'].push(['e.is_main', isMain].join('=')) 
	}

	if (date) {
		// @TODO: format validate yyyy-mm-dd
		q['date'] = date;
	}

	// Setting pagination
	if (itemsPerPage) {
		q['limit'] = itemsPerPage
	}
	if (pageNum) {
		q['offset'] = (pageNum-1) * itemsPerPage
	}

	// Setting order options
	if (orderByCol) {
		q['order by'] = [orderByCol, orderByMode].join(' ');
	}

	if (q['date']) {
		let today = new Date(q['date']);

		q['where'].push( 
				[
					'e.begin_time',
					'>=', 
					'\''+[today.getUTCFullYear(), today.getUTCMonth()+1, today.getUTCDate()].join('-')+' '+'00:00\'',
				].join(' ')
			);

		q['where'].push( 
				[
					'e.begin_time',
					'<=', 
					'\''+[today.getUTCFullYear(), today.getUTCMonth()+1, today.getUTCDate()].join('-')+' '+'23:59\'',
				].join(' ')
			);
		//console.log('where: ', q['where']);
	}

	// Constructing query
	let qs = [
			'SELECT', q['columns'].join(', '),
			'FROM', q['from'].join(', '),
			'WHERE', q['where'].join(' AND ')
		];

	qs['ORDER BY'] = q['orderby'];
	
	if (q['limit']>0) {
		qs.push( ['LIMIT', q['limit']].join(' ') ); 
	}
	
	if (q['offset']>0) {
		qs.push( ['OFFSET', q['offset'] ].join(' ') );
	}

	console.log('q: ', q);
	console.log('QUERY: ', qs.join(' '));



	db.any(qs.join(' '))
	.then(eventsList => {

		let eventsIDs = []
		let eventId2IndexMap = {}

		for (let i in eventsList) {
			eventsIDs.push( eventsList[i].id );
			eventId2IndexMap[ eventsList[i].id ] = i;
		}

		let qCats = [
						'SELECT e2c.event_id, c.id cat_id, c.title cat_title',
						'FROM categories c, event2cats e2c',
						'WHERE',
							[
								'e2c.category_id = c.id',
								'e2c.event_id IN ('+eventsIDs.join(',')+')'
							].join(' AND ')
					];

					//console.log('qCats: ', qCats.join(' '));

		db.any(qCats.join(' '))
			.then(cats => {

				let eventIdx;

				for (let i in cats) {
					
					eventIdx = eventId2IndexMap[cats[i].event_id];

					//console.log('cat_item: ', eventsList[ eventIdx ]);

					if (undefined === eventsList[ eventIdx ]['categories']) {
						eventsList[ eventIdx ]['categories'] = [];
					}

					eventsList[ eventIdx ]['categories'].push({
						'id': cats[i].cat_id,
						'title': cats[i].cat_title
					});
				}

				responseSuccess(res, {
		          code: 200,
		          data: eventsList
		        })

			})
			.catch(err => {
				//console.log('error selecting cats');
				responseError(res, {
					code: 404
				})
			})
	})
	.catch(err => {
		responseError(res, {
			code: 404
		})	
	});
}



function getEvent(req, res, next) {
	let id = parseInt(req.params.id);

	let q = [
				'SELECT', EVENT_COLUMNS.join(), 
				'FROM', 'events e, places p', 
				'WHERE', 
					[
						'e.id = ' + id,
						'p.id = e.place_id'
					].join(' AND ')
			]

			console.log(q.join(' '));

  	db.one(q.join(' '))		
    .then( data => {
      	responseSuccess(res, {
          code: 200,
          data: data
        })
    })
    .catch( err => {
      	responseError(res, {
			code: 404
		})
    });
}



function getDaysEvents(req, res, next) {

	let placeId = ~~req.query.place
	let categoryId = ~~req.query.category

	if (!placeId && !categoryId) {
		responseError(res, {
			code: 404
		})
        return;
	}

	let from = ['events e']
	let where = []

	if (categoryId) {
		from.push('event2cats e2c');
		where.push('e.id = e2c.event_id');
		where.push('e2c.category_id='+categoryId);
	} else {
		where.push('e.place_id='+placeId);
	}

	let q = [
				'SELECT',
					[
						'EXTRACT(DAY FROM e.begin_time) d', 
						'EXTRACT(YEAR FROM e.begin_time) y', 
						'EXTRACT(MONTH FROM e.begin_time) m', 
						'count(*) count'
					].join(', '),
				'FROM', from.join(', '),
				'WHERE', where.join(' AND '),
				'GROUP BY y,m,d'
			];

	console.log('q: ', q.join(' '));

	db.any(q.join(' '))
    .then( dates => {

    	// Concat date from [y], [m], [d] => [y-m-d]
    	for (let i in dates) {
    		dates[i].dt = [
		    			dates[i].y, 
		    			("0"+dates[i].m).slice(-2), 
		    			("0"+dates[i].d).slice(-2) 
		    		].join('-');

    		delete dates[i].y;
    		delete dates[i].m;
    		delete dates[i].d;
    	}

      	responseSuccess(res, {
          code: 200,
          data: dates
        })
    })
    .catch( err => {
      	responseError(res, { code:404 })
    });
}





function getCountEvents(req, res, next) {

	let type = req.query.type

	if (!type || -1 === ['byplaces', 'bycategories'].indexOf(type)) {
		res.status(404)
        .json({
			code: 404
        });
        return;
	}
	let columns = []
	let from = []
	let where = []
	let groupby = []

	switch (type) {
		case 'bycategories':
			columns.push('c.id', 'c.title', 'c.order_priority', 'count(e2c.event_id) events_count');
			from.push('categories c LEFT JOIN event2cats e2c ON e2c.category_id = c.id');
			groupby.push('c.id');
			break;
		case 'byplaces':
			columns.push('p.id', 'p.title', 'p.order_priority', 'count(e.id) events_count');
			from.push('places p LEFT JOIN events e ON e.place_id = p.id');
			//where.push('e.place_id = p.id');
			groupby.push('p.id');
			break;
	}


	let q = [
				'SELECT', columns.join(', '),
				'FROM', from.join(', '),
				( where.length ? 'WHERE ' + where.join(' AND ') : '' ),
				'GROUP BY', groupby.join(', '),
				'ORDER BY order_priority DESC'
			];


	console.log('q: ', q.join(' '));

	db.any(q.join(' '))
    .then( data => {
      	responseSuccess(res, {
          code: 200,
          data: data
        })
    })
    .catch( err => {
      	responseError(res, { code:404 })
    });
}



function responseSuccess(res, response) {
	res.status(200).setHeader('Content-Type', 'application/json');
	res.json(response);
}

function responseError(res, response) {
	res.status(404).setHeader('Content-Type', 'application/json');
	res.json(response);
}


function __install(req, res, next) {
  	
}







