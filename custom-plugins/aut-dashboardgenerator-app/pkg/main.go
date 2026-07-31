package main

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/app"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

func main() {
	log.DefaultLogger.Info("Backend starting...")

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