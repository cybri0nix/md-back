# MoscowDay - back-end NodeJS application

## API documentation


### ```/events?param=val&param=val```
`Получить список событий`

GET-параметр | Описание | Значение | Пример 
--- | --- | --- | ---
page | Номер страницы | int | /events?page=2
items_per_page | Количество элементов на одну страницу | int | /events?items_per_page=15
category | Получить список событий в указанной категории | int, ID категории | /events?category=2
date | Дата в формате YYYY-MM-DD. Получить список событий на эту дату | | /events?date=2017-09-03
is_main | Получить события, которые помечены как "главные события" | 0 | /events?is_main=1
place | Получить список событий в указанном месте | int, id места | /events?place=2

#### Ответ



### ```/event/<event_id>```
`Получить данные об одном событии`

Параметр  | Пример 
--- | ---
Номер страницы | /event/2

#### Ответ




### ```/daysevents```

#### Ответ





### ```/countevents```


#### Ответ