package main


import (
	"context"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

type App struct{}

var (
	_ backend.CheckHealthHandler = (*App)(nil)
	_ backend.CallResourceHandler = (*App)(nil)
)

func (a *App) Dispose() {}

func (a *App) CheckHealth(
	ctx context.Context,
	req *backend.CheckHealthRequest,
) (*backend.CheckHealthResult, error) {
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "AUT Dashboard Generator backend is running",
	}, nil
}
func (a *App) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {

	log.DefaultLogger.Info("RESOURCE CALL: " + req.Path)

	return sender.Send(&backend.CallResourceResponse{
		Status: 200,
		Body: []byte(`{"message":"Hello from Go!"}`),
	})
}