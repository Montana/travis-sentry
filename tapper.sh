#!/bin/bash
h=$1;s=${2:-1};e=${3:-1024};f=false;j=false;q=false
for a in "$@";do
case $a in
--fail-on-closed)f=true;;
--json)j=true;;
--quiet)q=true;;
esac;done
[ -z "$h" ]&&echo "usage:$0 <host> [start_port] [end_port] [--fail-on-closed] [--json] [--quiet]"&&exit 1
[[ ! "$s" =~ ^[0-9]+$ || ! "$e" =~ ^[0-9]+$ || $s -gt $e ]]&&echo "invalid port range:$s to $e"&&exit 1
c=0;r=()
for((p=s;p<=e;p++));do
timeout 1 bash -c "echo >/dev/tcp/$h/$p" 2>/dev/null&&{ $q||echo "port $p open";r+=("{\"port\":$p,\"status\":\"open\"}");continue;}
$q||echo "port $p closed";r+=("{\"port\":$p,\"status\":\"closed\"}");((c++))
done
$j&&echo "[${r[*]}]"|jq '.'
$f&&[ $c -gt 0 ]&&echo "$c closed"&&exit 2
exit 0
