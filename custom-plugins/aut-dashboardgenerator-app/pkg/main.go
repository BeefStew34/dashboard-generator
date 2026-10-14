package main

import (
	"context"
	"fmt"
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

	log.DefaultLogger.Debug("Starting application")

	db, err = sql.Open("sqlite", "file:"+dbPath+"?mode=rwc")
	if err != nil {
		log.DefaultLogger.Error("Failed to open database", "error", err)
		return
	}

	if err = db.Ping(); err != nil {
		log.DefaultLogger.Error("Database ping failed", "error", err)
		return
	}

	if err := ensureUserDataSchema(db); err != nil {
		log.DefaultLogger.Error("Failed to initialize user settings", "error", err)
		return
	}

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
	parts := strings.Split(values, ",")
	if len(parts) != 5 && len(parts) != 6 {
		return fmt.Errorf("expected five legacy settings or six settings including datasource UID")
	}
	ValidateUser(userid)
	if len(parts) == 5 {
		_, err := db.Exec("UPDATE userdata SET OpenAIKey = ?, ClaudeAIKey = ?, SelectedAI = ?, ViewMode = ?, Model = ? WHERE id = ?", parts[0], parts[1], parts[2], parts[3], parts[4], userid)
		return err
	}
	_, err := db.Exec("UPDATE userdata SET OpenAIKey = ?, ClaudeAIKey = ?, SelectedAI = ?, ViewMode = ?, Model = ?, DataSourceUID = ? WHERE id = ?", parts[0], parts[1], parts[2], parts[3], parts[4], parts[5], userid)
	return err
}

func GetKeys(userid string) (string, error) {
	ValidateUser(userid)
	query := "SELECT OpenAIKey, ClaudeAIKey, SelectedAI, ViewMode, Model, COALESCE(DataSourceUID, '') FROM userdata WHERE id = ?"
	var values [6]string
	err := db.QueryRow(query, userid).Scan(&values[0], &values[1], &values[2], &values[3], &values[4], &values[5])
	if err != nil {
		return "", err
	}
	return strings.Join(values[:], ","), nil
}

func NewApp(ctx context.Context, settings backend.AppInstanceSettings) (instancemgmt.Instance, error) {
	return &App{}, nil
}
