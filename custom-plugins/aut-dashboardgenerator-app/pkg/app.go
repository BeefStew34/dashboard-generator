package main


import (
	"context"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"encoding/json"
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
	log.DefaultLogger.Info("RESOURCE BODY: " + string(req.Body[:]))
	log.DefaultLogger.Info("RESOURCE PATH: " + req.Path)

	switch req.Path{
	case "set_key":
		var dat map[string]any
		json.Unmarshal(req.Body, &dat)
		search_key := dat["key"].(string)
		value := dat["value"].(string)
		userid := dat["userid"].(string)

		log.DefaultLogger.Info("User : " + userid + ", Key : " + search_key + " setting to " + value)

		err := SetKey(userid, search_key, value)

		if err != nil {
			return sender.Send(&backend.CallResourceResponse{
				Status: 500,
				Body: []byte(`{"message":"Error setting key!"}`),
			})
		}
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body: []byte(`{"message":"Key set successfully!"}`),
		})

	case "get_key":
		var dat map[string]any
		json.Unmarshal(req.Body, &dat)
		search_key := dat["key"].(string)
		userid := dat["userid"].(string)

		log.DefaultLogger.Info("User : " + userid + ", Key : " + search_key)

		value, err := GetKey(userid, search_key)

		if err != nil {
			return sender.Send(&backend.CallResourceResponse{
				Status: 500,
				Body: []byte(`{"message":" No Key Found "}`),
			})
		}
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body: []byte(`{"message":"` + value + `"}`),
		})
	default:
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body: []byte(`{"message":"Hello from Go!"}`),
		})
	}
}