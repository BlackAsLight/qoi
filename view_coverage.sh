file="coverage/html/index.html"

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
xdg-open "$file"
elif [[ "$OSTYPE" == "darwin"* ]]; then
open "$file"
else
start "$file"
fi
