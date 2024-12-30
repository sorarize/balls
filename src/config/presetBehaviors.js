export const PRESET_BEHAVIORS = {
  'Default Repulsion': `// Basic repulsion behavior between circles
function update(circle, others) {
  others.forEach(other => {
    if (other === circle) return;

    const direction = p5.Vector.sub(circle.pos, other.pos);
    const distance = direction.mag();

    if (distance < circle.minDist) {
      direction.normalize();
      const force = (circle.minDist - distance) / circle.minDist;
      direction.mult(force * circle.repulsionForce);
      circle.vel.add(direction);
    }
  });

  circle.vel.mult(circle.friction);
  circle.pos.add(circle.vel);
}`,

  'Gravity': `function gravity(circle, others) {
  circle.vel.y += 0.2;
  circle.pos.add(circle.vel);

  if (circle.pos.y > p.height - circle.radius) {
    circle.pos.y = p.height - circle.radius;
    circle.vel.y *= -0.8;
  }
  if (circle.pos.x > p.width - circle.radius || circle.pos.x < circle.radius) {
    circle.vel.x *= -1;
  }
}`,

  'Color Change': `function colorChange(circle, others) {
  others.forEach(other => {
    if (other === circle) return;

    const direction = p5.Vector.sub(circle.pos, other.pos);
    const distance = direction.mag();

    if (distance < circle.minDist) {
      direction.normalize();
      const force = (circle.minDist - distance) / circle.minDist;
      direction.mult(force * circle.repulsionForce);
      circle.vel.add(direction);

      // Change color based on distance
      circle.color.h = (circle.color.h + 1) % 360;
    }
  });

  circle.vel.mult(circle.friction);
  circle.pos.add(circle.vel);
}`,

  'Breathe': `function breathe(circle, others) {
    const time = Date.now() * 0.001; // 轉換為秒
    const baseRadius = 10;
    const breathAmount = 5;
    circle.radius = baseRadius + Math.sin(time * 2) * breathAmount;
    circle.defaultUpdate(others);
}`,

  'Bird': `function bird(circle, others) {
  const frameCount = p.frameCount;
  const centerX = p.width / 2;
  const centerY = p.height / 2;
  const angle = frameCount * 0.02;
  const radius = 100 + Math.sin(frameCount * 0.05) * 50;

  const targetX = centerX + Math.cos(angle) * radius;
  const targetY = centerY + Math.sin(angle) * radius;

  circle.pos.x += (targetX - circle.pos.x) * 0.05;
  circle.pos.y += (targetY - circle.pos.y) * 0.05;

  circle.defaultUpdate(others);
}`,

  'Magnetic': `function magnetic(circle, others) {
  others.forEach(other => {
    if (other === circle) return;

    const direction = p5.Vector.sub(other.pos, circle.pos);
    const distance = direction.mag();

    if (distance < 200 && distance > 80) {
      const force = distance * 0.0005;
      direction.normalize().mult(force);
      circle.vel.add(direction);
    }
  });

  circle.vel.mult(0.9);
  circle.pos.add(circle.vel);

  circle.defaultUpdate(others);
}`,
};
