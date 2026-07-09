<<<<<<< HEAD
SET PGPASSWORD=%1
..\PostgreSQL\11\bin\psql --username=%2 --port=%3 --file=db-init.sql --host=localhost --dbname=%4 > db_init.log
SET PGPASSWORD=%1
=======
SET PGPASSWORD=%1
..\PostgreSQL\11\bin\psql --username=%2 --port=%3 --file=db-init.sql --host=localhost --dbname=%4 > db_init.log
SET PGPASSWORD=%1
>>>>>>> 5d794cfe4a805972016238b1c6d5dc8f9cb13499
exit