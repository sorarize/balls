let ws;
let circles = [];

function setup() {
    createCanvas(800, 600);
    background(255);

    // 根據環境使用適當的 WebSocket URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'init') {
            // 初始化時接收所有現有的圓形
            circles = data.circles;
        } else if (data.type === 'update') {
            // 接收新的圓形
            circles.push(data.circle);
        }
    };
}

function draw() {
    background(255);
    for (let circle of circles) {
        fill(circle.color);
        noStroke();
        ellipse(circle.x, circle.y, 20, 20);
    }
}

function mousePressed() {
    if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
        // 產生隨機顏色
        const color = `rgb(${random(255)},${random(255)},${random(255)})`;
        const newCircle = {
            x: mouseX,
            y: mouseY,
            color: color
        };

        // 立即在本地添加和繪製
        circles.push(newCircle);

        // 發送到伺服器
        ws.send(JSON.stringify(newCircle));
    }
}
