package main

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/app"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"database/sql"
    _ "modernc.org/sqlite"
	"os"
)

var db *sql.DB

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
	_ = os.WriteFile("sqlite_test.txt", []byte("works"), 0644)
	if err := app.Manage(
		"aut-dashboardgenerator-app",
		NewApp,
		app.ManageOpts{},
	); err != nil {
		log.DefaultLogger.Error("Failed to manage app", "error", err)
	}
}

func NewApp(ctx context.Context, settings backend.AppInstanceSettings) (instancemgmt.Instance, error) {
	return &App{}, nil
}