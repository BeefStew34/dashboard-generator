package main

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/app"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"database/sql"
    _ "modernc.org/sqlite"
	"github.com/hashicorp/go-set/v3"
)

var db *sql.DB
var usercache = set.New[string](0)

func main() {
	dbPath := "./user_data.db"
	var err error
	user_keys := [3]string{"openai_apikey", "claude_apikey","selected_model"}

	db, err = sql.Open("sqlite", "file:"+dbPath+"?mode=rwc")
	if err != nil {
		log.DefaultLogger.Error("Failed to open database", "error", err)
		return
	}

	if err = db.Ping(); err != nil {
		log.DefaultLogger.Error("Database ping failed", "error", err)
		return
	}

	table_constructor := "CREATE TABLE IF NOT EXISTS userdata (id INTEGER PRIMARY KEY,"
	for _, key := range user_keys {
		table_constructor += key + " TEXT, "
	}
	table_constructor = table_constructor[:len(table_constructor)-2] + ")"
	db.Exec(table_constructor)

	if err := app.Manage(
		"aut-dashboardgenerator-app",
		NewApp,
		app.ManageOpts{},
	); err != nil {
		log.DefaultLogger.Error("Failed to manage app", "error", err)
	}
}

// Called everytime user data is accessed ensure that the user exists in the table
func ValidateUser(userid string){
	if usercache.Contains(userid) {
		return
	}
	query := "SELECT id FROM userdata WHERE id = ?"
	err := db.QueryRow(query, userid).Scan(&userid)
	if err != nil {
		query := "INSERT INTO userdata (id) VALUES (?)"
		db.Exec(query, userid)
	}

	usercache.Insert(userid)
}

func SetKey(userid string, key string, value string) error {
	ValidateUser(userid)
	query := "INSERT OR REPLACE INTO userdata (id, " + key + ") VALUES ((SELECT id FROM userdata WHERE id = ?), ?)"
	_, err := db.Exec(query, userid, value)
	return err
}

func GetKey(userid string, key string) (string, error) {
	ValidateUser(userid)
	query := "SELECT " + key + " FROM userdata WHERE id = ?"
	var value string
	err := db.QueryRow(query, userid).Scan(&value)
	if err != nil {
		return "", err
	}
	return value, nil
}

func NewApp(ctx context.Context, settings backend.AppInstanceSettings) (instancemgmt.Instance, error) {
	return &App{}, nil
}