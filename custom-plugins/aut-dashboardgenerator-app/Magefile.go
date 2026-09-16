//go:build mage
// +build mage

package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"
)

var Default = Build

const pluginID = "aut-dashboardgenerator-app"

func Build() error {
	mg.Deps(Clean)

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

func Clean() error {
	return os.RemoveAll("dist")
}

func Frontend() error {
	env := map[string]string{
		"NODE_OPTIONS": "--openssl-legacy-provider",
	}

	if err := sh.RunV("npm", "install"); err != nil {
		return err
	}

	return sh.RunWith(env, "npm", "run", "dev")
}

func Release() error {
	mg.Deps(Build)

	releaseDir := filepath.Join("..", "..", "release", "data", "plugins", pluginID)

	fmt.Printf("Clearing release dir: %s\n", releaseDir)
	if err := os.RemoveAll(releaseDir); err != nil {
		return fmt.Errorf("cleaning release dir: %w", err)
	}

	if err := os.MkdirAll(releaseDir, 0755); err != nil {
		return fmt.Errorf("creating release dir: %w", err)
	}

	fmt.Printf("Copying dist -> %s\n", releaseDir)
	return copyDir("dist", releaseDir)
}

func All() error {
	mg.Deps(Frontend, Build)
	return Release()
}

func copyDir(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}

		target := filepath.Join(dst, rel)

		if info.IsDir() {
			return os.MkdirAll(target, info.Mode())
		}

		return copyFile(path, target, info.Mode())
	})
}

func copyFile(src, dst string, mode os.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
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
