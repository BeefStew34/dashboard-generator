//go:build mage
// +build mage

package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"
)

var Default = Build

// Build builds the Grafana backend plugin binary.
func Build() error {
	mg.Deps(Clean)

	pluginID := "aut-dashboardgenerator-app"

	outDir := "dist"

	if err := os.MkdirAll(outDir, 0755); err != nil {
		return err
	}

	osName := goos()
	arch := goarch()

	binaryName := fmt.Sprintf(
		"%s_%s_%s",
		pluginID,
		osName,
		arch,
	)

	if osName == "windows" {
		binaryName += ".exe"
	}

	output := filepath.Join(outDir, binaryName)

	fmt.Printf("Building backend plugin: %s\n", output)

	return sh.RunV(
		"go",
		"build",
		"-o",
		output,
		"./pkg",
	)
}

// Clean removes previous builds.
func Clean() {
	os.RemoveAll("dist")
}

func goos() string {
	if v := os.Getenv("GOOS"); v != "" {
		return v
	}
	return "windows"
}

func goarch() string {
	if v := os.Getenv("GOARCH"); v != "" {
		return v
	}
	return "amd64"
}