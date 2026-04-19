#!/bin/bash
# Double-click file này để mở app

# Tìm port trống
PORT=8080
while lsof -i :$PORT &>/dev/null; do
  PORT=$((PORT + 1))
done

# Tự động thoát server khi đóng terminal
cleanup() { kill $SERVER_PID 2>/dev/null; }
trap cleanup EXIT

# Di chuyển vào thư mục chứa file này
cd "$(dirname "$0")"

# Chạy server
python3 -m http.server $PORT &>/dev/null &
SERVER_PID=$!

# Chờ server khởi động
sleep 0.5

# Mở browser
open "http://localhost:$PORT"

echo "✅ Lanyard 3D Badge đang chạy tại http://localhost:$PORT"
echo "👉 Đóng cửa sổ này để tắt server"
wait $SERVER_PID
