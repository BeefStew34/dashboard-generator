package main

import "database/sql"

func ensureUserDataSchema(database *sql.DB) error {
	_, err := database.Exec(`CREATE TABLE IF NOT EXISTS userdata (
		id INTEGER PRIMARY KEY,
		OpenAIKey TEXT DEFAULT '', ClaudeAIKey TEXT DEFAULT '',
		SelectedAI TEXT DEFAULT '', ViewMode TEXT DEFAULT 'Simple',
		Model TEXT DEFAULT 'none', DataSourceUID TEXT DEFAULT ''
	)`)
	if err != nil {
		return err
	}
	rows, err := database.Query("PRAGMA table_info(userdata)")
	if err != nil {
		return err
	}
	found := false
	for rows.Next() {
		var cid, notNull, primaryKey int
		var name, columnType string
		var defaultValue sql.NullString
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &primaryKey); err != nil {
			rows.Close()
			return err
		}
		if name == "DataSourceUID" {
			found = true
		}
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	if found {
		return nil
	}
	_, err = database.Exec("ALTER TABLE userdata ADD COLUMN DataSourceUID TEXT DEFAULT ''")
	return err
}
