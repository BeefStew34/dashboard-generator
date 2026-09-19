package main

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

type App struct{}

var (
	_ backend.CheckHealthHandler  = (*App)(nil)
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
	//log.DefaultLogger.Info("RESOURCE BODY: " + string(req.Body[:]))
	//log.DefaultLogger.Info("RESOURCE PATH: " + req.Path)

	switch req.Path {
	case "set_key":
		var dat map[string]any
		json.Unmarshal(req.Body, &dat)
		value := dat["values"].(string)
		userid := dat["userid"].(string)

		err := SetUserData(userid, value)

		if err != nil {
			log.DefaultLogger.Info("Error setting key for user " + userid + ": " + err.Error())
			return sender.Send(&backend.CallResourceResponse{
				Status: 500,
				Body:   []byte(`{}`),
			})
		}
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   []byte(`{}`),
		})

	case "get_key":
		var dat map[string]any
		json.Unmarshal(req.Body, &dat)
		userid := dat["userid"].(string)

		values, err := GetKeys(userid)

		if err != nil {
			log.DefaultLogger.Info("Error getting key for user " + userid + ": " + err.Error())
			return sender.Send(&backend.CallResourceResponse{
				Status: 500,
				Body:   []byte(`{}`),
			})
		}
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   []byte(`{"values":"` + values + `"}`),
		})
	default:
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   []byte(`{}`),
		})
	}
}
