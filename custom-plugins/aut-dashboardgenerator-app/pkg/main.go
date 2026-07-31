package main

import (
	"context"
	"log"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/app"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
)

func main() {
	if err := app.Manage(
		"aut-dashboardgenerator-app",
		NewApp,
		app.ManageOpts{},
	); err != nil {
		log.Fatal(err)
	}
}

func NewApp(ctx context.Context, settings backend.AppInstanceSettings) (instancemgmt.Instance, error) {
	return &App{}, nil
}