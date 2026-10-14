package main

import (
	"database/sql"
	"testing"

	"github.com/hashicorp/go-set/v3"
)

func testUserDatabase(t *testing.T) *sql.DB {
	t.Helper()
	database, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	database.SetMaxOpenConns(1)
	oldDB, oldCache := db, usercache
	db, usercache = database, set.New[string](0)
	t.Cleanup(func() { database.Close(); db, usercache = oldDB, oldCache })
	return database
}

func TestUserDataSchemaMigration(t *testing.T) {
	database := testUserDatabase(t)
	_, err := database.Exec(`CREATE TABLE userdata (id INTEGER PRIMARY KEY, OpenAIKey TEXT DEFAULT '', ClaudeAIKey TEXT DEFAULT '', SelectedAI TEXT DEFAULT '', ViewMode TEXT DEFAULT 'Simple', Model TEXT DEFAULT 'none'); INSERT INTO userdata (id, Model) VALUES (1, 'test-model')`)
	if err != nil {
		t.Fatal(err)
	}
	if err := ensureUserDataSchema(database); err != nil {
		t.Fatal(err)
	}
	if err := ensureUserDataSchema(database); err != nil {
		t.Fatal(err)
	}
	values, err := GetKeys("1")
	if err != nil {
		t.Fatal(err)
	}
	if values != ",,,Simple,test-model," {
		t.Fatalf("unexpected migrated settings: %q", values)
	}
}

func TestDataSourceSettingRoundTrip(t *testing.T) {
	database := testUserDatabase(t)
	if err := ensureUserDataSchema(database); err != nil {
		t.Fatal(err)
	}
	if err := SetUserData("2", "test-key,,openai,simple,test-model,working-uid"); err != nil {
		t.Fatal(err)
	}
	values, err := GetKeys("2")
	if err != nil {
		t.Fatal(err)
	}
	if values != "test-key,,openai,simple,test-model,working-uid" {
		t.Fatalf("unexpected settings: %q", values)
	}
	if err := SetUserData("2", "test-key,,openai,complex,new-model"); err != nil {
		t.Fatal(err)
	}
	values, err = GetKeys("2")
	if err != nil {
		t.Fatal(err)
	}
	if values != "test-key,,openai,complex,new-model,working-uid" {
		t.Fatalf("legacy update lost datasource: %q", values)
	}
}

func TestRejectMalformedSettings(t *testing.T) {
	if err := SetUserData("1", "invalid"); err == nil {
		t.Fatal("expected malformed settings error")
	}
}
