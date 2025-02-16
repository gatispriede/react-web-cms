#!/bin/bash

openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 -nodes -keyout example.com.key -out example.com.crt -subj "/CN=example.com" -addext "subjectAltName=IP=127.0.0.1,IP=104.248.39.167"