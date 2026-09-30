SET "GO_DIR_REL=./go/bin"
for %%I in ("%GO_DIR_REL%") do set "GO_DIR=%%~fI"
tar -xf go1.27.1.windows-amd64.zip
pathed /ADD  %GO_DIR% /USER