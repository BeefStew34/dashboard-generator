package main

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type App struct{}

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
	switch req.Path {
	case "hello":
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   []byte(`{"message":"Hello from Go!"}`),
		})

	default:
		return sender.Send(&backend.CallResourceResponse{
			Status: 404,
			Body:   []byte("not found"),
		})
	}
}