package main

import (
	"context"
	"strings"

	"database/sql"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/app"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/hashicorp/go-set/v3"
	_ "modernc.org/sqlite"
)

var db *sql.DB
var usercache = set.New[string](0)

func main() {
	dbPath := "./user_data.db"
	var err error
	user_keys := [4]struct {
		key   string
		value string
	}{{key: "OpenAIKey", value: ""}, {key: "ClaudeAIKey", value: ""}, {key: "SelectedAI", value: ""}, {key: "ViewMode", value: "Simple"}}

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
		table_constructor += key.key + " TEXT DEFAULT '" + key.value + "', "
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
func ValidateUser(userid string) {
	if usercache.Contains(userid) {
		return
	}
	query := "SELECT id FROM userdata WHERE id = ?"
	err := db.QueryRow(query, userid).Scan(&userid)
	if err != nil {
		query := "BEGIN TRANSACTION; INSERT INTO userdata (id) VALUES (?); COMMIT;"
		_, err := db.Exec(query, userid)
		if err != nil {
			log.DefaultLogger.Error("Failed to insert user", "error", err)
		}
	}

	usercache.Insert(userid)
}

func SetUserData(userid string, values string) error {
	ValidateUser(userid)
	query := "BEGIN TRANSACTION; UPDATE userdata SET OpenAIKey = ?, ClaudeAIKey = ?, SelectedAI = ?, ViewMode = ? WHERE id = ?; COMMIT;"
	var split_values = strings.Split(values, ",")
	_, err := db.Exec(query, split_values[0], split_values[1], split_values[2], split_values[3], userid)
	return err
}

func GetKeys(userid string) (string, error) {
	ValidateUser(userid)
	query := "SELECT * FROM userdata WHERE id = ?"
	var values [5]string
	err := db.QueryRow(query, userid).Scan(&values[0], &values[1], &values[2], &values[3], &values[4])
	if err != nil {
		return "", err
	}
	return strings.Join(values[1:5], ","), nil
}

func NewApp(ctx context.Context, settings backend.AppInstanceSettings) (instancemgmt.Instance, error) {
	return &App{}, nil
}
