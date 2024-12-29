export class Circle {
  constructor(x, y, color, minDist = 50) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.minDist = minDist;
    this.velocity = { x: 0, y: 0 };
    this.radius = 10;
    this.repulsionForce = 0.5;  // 排斥力大小
    this.friction = 0.95;       // 摩擦力
  }

  update(others) {
    // 計算與其他圓形的排斥力
    others.forEach(other => {
      if (other === this) return;

      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < this.minDist) {
        // 計算排斥力
        const force = (this.minDist - distance) / this.minDist;
        const angle = Math.atan2(dy, dx);

        // 應用排斥力
        this.velocity.x += Math.cos(angle) * force * this.repulsionForce;
        this.velocity.y += Math.sin(angle) * force * this.repulsionForce;
      }
    });

    // 應用摩擦力
    this.velocity.x *= this.friction;
    this.velocity.y *= this.friction;

    // 更新位置
    this.x += this.velocity.x;
    this.y += this.velocity.y;
  }

  draw(p) {
    p.fill(this.color);
    p.noStroke();
    p.ellipse(this.x, this.y, this.radius * 2);
  }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      color: this.color,
      minDist: this.minDist,
    };
  }

  static fromJSON(data) {
    return new Circle(data.x, data.y, data.color, data.minDist);
  }
}
