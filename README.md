# MoscowDay - back-end NodeJS application

## Installing
```
npm install
npm start


В файле app.js указать базу данных
DB_CONNECTION_STRING

Формат: postgres://[username]:[password]@[host]:[port]/[database]

```

## Stack
* PostgreSQL 9.6+ (for mac https://postgresapp.com)
* NodeJS 6+
* NPM 3.10.10+

#### Tools
* PostgreSQL GUI: PgAdmin 4 (https://www.pgadmin.org/download/pgadmin-4-macos)

## SQL
```sql
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

SET search_path = public, pg_catalog;

CREATE SEQUENCE categories_id_seq;
CREATE SEQUENCE event2cats_id_seq;
CREATE SEQUENCE events_id_seq;
CREATE SEQUENCE places_id_seq;
CREATE SEQUENCE stat_id_seq;

CREATE TABLE public.categories
(
    id bigint NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
    title character varying(300) COLLATE pg_catalog."default",
    order_priority smallint NOT NULL DEFAULT 0,
    CONSTRAINT categories_pkey PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;


CREATE TABLE public.event2cats
(
    category_id integer,
    event_id bigint,
    id bigint NOT NULL DEFAULT nextval('event2cats_id_seq'::regclass),
    CONSTRAINT event2cats_pkey PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;


CREATE TABLE public.events
(
    id bigint NOT NULL DEFAULT nextval('events_id_seq'::regclass),
    title character varying(400) COLLATE pg_catalog."default" NOT NULL,
    begin_time timestamp(6) with time zone NOT NULL,
    description text COLLATE pg_catalog."default",
    location_title character varying(300) COLLATE pg_catalog."default",
    lng real,
    lat real,
    favs_count integer,
    updated_time timestamp(6) with time zone,
    photo character varying(500) COLLATE pg_catalog."default" NOT NULL,
    place_id integer,
    created_time timestamp(6) with time zone,
    is_main smallint NOT NULL DEFAULT 0,
    is_bold smallint NOT NULL DEFAULT 0,
    CONSTRAINT events_pkey PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;


CREATE TABLE public.places
(
    title character varying(300) COLLATE pg_catalog."default" NOT NULL,
    photo character varying(500) COLLATE pg_catalog."default" NOT NULL,
    order_priority smallint DEFAULT 0,
    id bigint NOT NULL DEFAULT nextval('places_id_seq'::regclass),
    CONSTRAINT places_pkey PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;
```


## API documentation


---

### Response codes
```javascript
{
	"code":200, // Что-то нашлось, без ошибок
	...
}
{
	"code":404, // Ничего не найдено, либо произошла ошибка (времени на крутую обработку ошибок нет ;) )
	...
}
```

### _eventModel_

```javascript
{
	"id": "5",
	"begin_time": "2017-07-08T10:00:00.000Z", // Время и дата начала
	"dateFormatted": {
		"day": 12,
		"month": "августа",
		"time": "13:00"
	},
	"title": "Event 2",
	"location_title": "Парк Горького", // Адрес проведения события
	"description": "event 2 description", // Описание
	"lng": 52,
	"lat": 72,
	"favs_count": 0, // Сколько людей добавили в избранное? (еще не реализовано)
	"is_main": 1, // Помечено ли событие, как главное?
	"is_bold": 1, // Выделять ли жирным в таймлайне?
	"photo": "2.jpg", // Резолвинг фотографии еще надо утвердить
	"place_title": "Place 1", // Место проведения
	"place_id": "1",
	"categories":[
		{
			"id": "3",
			"title": "Category 3"
		},
		{
			"id": "2",
			"title": "Category 2"
		}
	]
}
```


### ```/events?param=val&param=val```
`Получить список событий`

GET-параметр | Описание | Значение | Пример 
--- | --- | --- | ---
page | Номер страницы | integer | /events?page=2
items_per_page | Количество элементов на одну страницу | integer | /events?items_per_page=15
category | Получить список событий в указанной категории | integer, ID категории | /events?category=2
date | Дата в формате YYYY-MM-DD. Получить список событий на эту дату | YYYY-MM-DD, string | /events?date=2017-09-03
is_main | Получить события, которые помечены как "главные события" | 1 or 0 | /events?is_main=1
place | Получить список событий в указанном месте | integer, id места | /events?place=2

#### Ответ
```javascript
{
	"code":200,
	"data":[
			{ _eventModel_ }	
			{ _eventModel_ }, 
			{ _eventModel_ },
			{ _eventModel_ }
		]
}
```

---


### ```/event/<event_id>```
`Получить данные об одном событии`

Параметр  | Пример 
--- | ---
ID события, integer | /event/2

#### Ответ
```javascript
{
	"code":200,
	"data":{
		_eventModel_ (в мета-данные об одном событии, не приходят категории)
	}
}
```

---


### ```/daysevents```
`Вернет список дат (дней), в которых есть события (и количество событий в этот день) в указанной рубике или месте`

GET-Параметр | Описание | Пример 
--- | --- | ---
place | ID места, integer | /daysevents?place=1
category | ID категории, integer | /daysevents?category=2

`Параметры place/category являются взаимоисключающими`

#### Ответ
```javascript
{
	"code":200,
	"data":[
			{
				"count":"1", // Количество событий на эту дату
				"dt":"2017-07-08"
			}
		]
}
```


---


### ```/countevents```
`Получить список всех рубрик/мест с количеством событий`

GET-Параметр | Описание | Пример
--- | --- | ---
type | byplaces - вернет список мест с количеством событий | /countevents?type=byplaces
type | bycategories - вернет список категорий с количеством событий | /countevents?type=bycategories


#### Ответ - byplaces
`order_priority - приоритет при сортировке, например, категорию "салюты"" мы поднимем вверх, приоритет у салютов будет самым высоким`

```javascript
{
	"code":200,
	"data":
			[
				{
					"id":"6",
					"title":"more priority place 6",
					"order_priority":2,
					"events_count":"0"
				},
				{
					"id":"5",
					"title":"High priority place 5",
					"order_priority":1,
					"events_count":"0"
				},
				{ ... }, 
				{ ... }
			]
	}
```


#### Ответ - bycategories

```javascript
{
	"code":200,
	"data":[
			{
				"id":"6",
				"title":"Fireworks",
				"order_priority":1,
				"events_count":"0"
			},
			{
				"id":"4",
				"title":"Category 4",
				"order_priority":0,
				"events_count":"1"
			},
			{
				"id":"5",
				"title":"Category 5",
				"order_priority":0,
				"events_count":"1"
			},
			{
				"id":"2",
				"title":"Category 2",
				"order_priority":0,
				"events_count":"2"
			}
		]
}
```
