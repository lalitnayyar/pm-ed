# Scripts Guide

This folder contains start and stop scripts for Linux, Mac, and Windows to run the Dockerized backend scaffold.

## Files

- `start-linux.sh`
- `stop-linux.sh`
- `start-mac.sh`
- `stop-mac.sh`
- `start-windows.ps1`
- `stop-windows.ps1`

## Behavior

- Start scripts build the Docker image and run container `pm-mvp` on port `8000`.
- Stop scripts remove the container if it exists.