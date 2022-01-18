kwerc-redis
===========

Redis + RedisGraph support for [kwerc](https://github.com/kwerc/kwerc).

Installation
------------

Throw *.es in kwerc/es/.

In kwerc/es/kwerc.es, replace:

    . ./auth.es

with:

    . ./redis.es
    . ./rgauth.es

Add the REDISCLI_* configuration from config.example to your kwerc
config.

Usage
-----

```
redis 'some redis command'

redis graph read 'some redisgraph command'
redis graph write 'some redisgraph command'

some_command < redis:some_key
some_command > redis:some_key
some_command >> redis:some_key

cat redis:some_key
test -e redis:some_key
rm redis:some_key
```

Coming Soon(tm)
---------------

* Better RedisGraph output formatting
* RediSearch support

Disclaimer
----------

Non-graph Redis is mostly untested.

Contact
-------

m@kfarwell.org

License
-------

kwerc-redis is distributed under the ISC license. See LICENSE for
details.
