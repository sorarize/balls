import p5 from 'p5';
import xx from '@utils/xx';
import Config from '@config/index';
import { roundToDecimals } from '@utils';

export class Circle {
  constructor(x, y, color, minDist = Config.CIRCLE_MIN_DIST, id = null, userId = null, radius = null) {
    this.pos = new p5.Vector(x, y);
    this.vel = new p5.Vector(0, 0);
    this.color = color;
    this.minDist = minDist;
    this.id = id || Date.now() + Math.random();
    this.userId = userId;
    this.radius = radius || Config.CIRCLE_RADIUS;
    this.repulsionForce = 0.5;
    this.friction = 0.9;
    this.customUpdateBehavior = null;
  }

  defaultUpdate(others) {
    others.forEach(other => {
      if (other === this) return;

      const direction = p5.Vector.sub(this.pos, other.pos);
      const distance = direction.mag();

      if (distance < this.minDist) {
        direction.normalize();
        const force = (this.minDist - distance) / this.minDist;
        direction.mult(force * this.repulsionForce);
        this.vel.add(direction);
      }
    });

    this.vel.mult(this.friction);
    this.pos.add(this.vel);
  }

  update(others, p) {
    if (this.customUpdateBehavior) {
      try {
        this.customUpdateBehavior(this, others, p);

        // 使用 util 函數處理精度
        this.pos.x = roundToDecimals(this.pos.x, Config.POSITION_DECIMALS);
        this.pos.y = roundToDecimals(this.pos.y, Config.POSITION_DECIMALS);
        this.vel.x = roundToDecimals(this.vel.x, Config.VELOCITY_DECIMALS);
        this.vel.y = roundToDecimals(this.vel.y, Config.VELOCITY_DECIMALS);
      } catch (error) {
        xx('Error in custom update behavior:', error);
        this.defaultUpdate(others);
      }
    } else {
      this.defaultUpdate(others);
    }
  }

  draw(p) {
    if (!this.color || typeof this.color !== 'object') {
      xx('Invalid color:', this.color);
      p.fill(0, 0, 50);
    } else {
      const { h = 0, s = Config.SATURATION, l = Config.LIGHTNESS } = this.color;
      p.fill(h, s, l);
    }
    p.noStroke();
    p.ellipse(this.pos.x, this.pos.y, this.radius * 2);
  }

  toJSON() {
    return {
      x: this.pos.x,
      y: this.pos.y,
      color: this.color,
      minDist: this.minDist,
      id: this.id,
      userId: this.userId,
      radius: this.radius,
    };
  }

  updatePosition(x, y) {
    this.pos.set(x, y);
    this.vel.set(0, 0);
  }

  static fromJSON(data) {
    const color = data.color && typeof data.color === 'object'
      ? { ...data.color }
      : { h: 0, s: Config.SATURATION, l: Config.LIGHTNESS };

    return new Circle(
      data.x,
      data.y,
      color,
      data.minDist,
      data.id,
      data.userId,
      data.radius,
    );
  }

  setCustomUpdateBehavior(behavior) {
    this.customUpdateBehavior = behavior;
  }
}
