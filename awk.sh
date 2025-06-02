#!/bin/bash
seq 1 5 | awk '{print "log:"$1}' | sed 's/log/entry/' | tr a-z A-Z | cut -c1-6 | while read l; do echo $l; done
echo "user@$(hostname)" | awk -F@ '{print "user="$1" host="$2}'
echo "one:two:three" | tr ':' '\n' | awk '{print NR"-"$1}'
echo "$(date +%F_%T)" | sed 's/:/-/g'
yes | head -n1 | awk '{print "ready"}'
