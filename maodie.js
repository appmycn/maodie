/*!
 * Maodie.js - Spider Screen Effect
 * Version: 1.1.0
 * GIF: https://uy.wzznft.com/i/2025/09/04/grxn35.gif
 *
 * Copyright (C) 2025 Maodie Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/* 
 * https://kickassapp.com/
 * javascript:var s=document.createElement('script');s.type='text/javascript';document.body.appendChild(s);s.src='http://127.0.0.1/maodie.js';void(0);
 * javascript:void(document.body.appendChild(document.createElement('script')).src='http://127.0.0.1/maodie.js')
 *
 *
*/

(() => {
  'use strict';

  // 资源（已提供的 GIF 动图）
  const GIF_URL = 'maodie.gif';
  const NATURAL_W = 282;
  const NATURAL_H = 97;

  const VERSION = '1.1.0';

  // 默认配置
  const DEFAULTS = {
    count: 9,                 // 蜘蛛数量
    scaleMin: 0.15,           // 最小缩放
    scaleMax: 0.25,           // 最大缩放
    zIndex: 2147481000,       // 覆盖层级
    debug: false,             // 显示平台调试线
    // 运动参数
    speedMin: 55,             // px/s
    speedMax: 95,             // px/s
    scareSpeedMultiplier: 2.2,
    jumpSpeedMin: 420,        // 初速度 vy（向上为负）
    jumpSpeedMax: 560,
    gravity: 2600,            // px/s^2
    idleChance: 0.14,         // 进入 Idle 的概率（每秒概率近似）
    idleMin: 0.6,             // s
    idleMax: 2.0,             // s
    scareRadius: 140,         // 鼠标靠近触发 Scare（加速）
    platformOffsetY: 1,       // 平台高度微调
    platformMinWidth: 80,     // 有效平台的最小宽度
    platformMinHeight: 16,    // 元素本身最小高度
    maxPlatforms: 600         // 最大平台数（防止极端页面）
  };

  // 小工具
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => Math.random() * (max - min) + min;
  const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const now = () => (window.performance && performance.now ? performance.now() : Date.now());

  const ready = (fn) => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  };

  // 读取配置：window.MaodieSpiderConfig > script data- 属性 > 默认
  const readConfig = () => {
    const cfgFromWindow = (typeof window.MaodieSpiderConfig === 'object' && window.MaodieSpiderConfig) || {};
    const script = document.currentScript || Array.from(document.scripts || []).slice(-1)[0];
    const ds = (script && script.dataset) || {};
    const numOr = (v, d) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    };
    const boolOr = (v, d) => {
      if (v === undefined) return d;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') return v === 'true' || v === '1';
      return d;
    };
    const cfg = {
      count: numOr(ds.count, DEFAULTS.count),
      scaleMin: numOr(ds.scaleMin, DEFAULTS.scaleMin),
      scaleMax: numOr(ds.scaleMax, DEFAULTS.scaleMax),
      zIndex: numOr(ds.zIndex, DEFAULTS.zIndex),
      debug: boolOr(ds.debug, DEFAULTS.debug)
    };
    return Object.assign({}, DEFAULTS, cfg, cfgFromWindow || {});
  };

  // 可见性与尺寸判断
  const isElementVisibleAndUsable = (el, minW, minH) => {
    if (!el || !(el instanceof Element)) return false;
    if (el.closest('.maodie-spider-layer')) return false; // 忽略自身层
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.02) return false;
    if (style.position === 'fixed') return false; // 固定元素顶部随视口移动，作为平台效果差
    const rect = el.getBoundingClientRect();
    if (rect.width < minW || rect.height < minH) return false;
    return true;
  };

  // 平台结构：{x1, x2, y, el}
  const scanPlatforms = (config) => {
    const selector = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, img, figure, picture';
    const nodes = Array.from(document.querySelectorAll(selector));
    const platforms = [];
    const minW = config.platformMinWidth;
    const minH = config.platformMinHeight;
    const pageX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const pageY = window.pageYOffset || document.documentElement.scrollTop || 0;

    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (!isElementVisibleAndUsable(el, minW, minH)) continue;
      const rect = el.getBoundingClientRect();
      const x1 = rect.left + pageX;
      const x2 = rect.right + pageX;
      const y = rect.top + pageY - config.platformOffsetY;
      if (x2 - x1 < minW) continue;
      platforms.push({ x1, x2, y, el });
      if (platforms.length >= config.maxPlatforms) break;
    }

    // 合并同层相邻/重叠段
    platforms.sort((a, b) => (a.y - b.y) || (a.x1 - b.x1));
    const merged = [];
    const yEps = 2;
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (!merged.length) {
        merged.push({ x1: p.x1, x2: p.x2, y: p.y, el: p.el });
        continue;
      }
      const last = merged[merged.length - 1];
      if (Math.abs(p.y - last.y) <= yEps && p.x1 <= last.x2 + 8) {
        last.x2 = Math.max(last.x2, p.x2);
      } else {
        merged.push({ x1: p.x1, x2: p.x2, y: p.y, el: p.el });
      }
    }
    return merged;
  };

  // 覆盖层与样式
  const injectStyleOnce = (zIndex) => {
    if (document.getElementById('maodie-style')) return;
    const style = document.createElement('style');
    style.id = 'maodie-style';
    style.textContent = `
      .maodie-spider-layer {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: ${zIndex};
        contain: layout style size;
      }
      .maodie-spider {
        position: absolute;
        will-change: transform, opacity;
        pointer-events: auto;
        user-select: none;
        -webkit-user-drag: none;
        image-rendering: auto;
        transform-origin: 50% 50%;
      }
      .maodie-spider img, .maodie-spider .sprite {
        width: 100%;
        height: 100%;
        display: block;
        pointer-events: none;
        user-select: none;
      }
      .maodie-debug-line {
        position: absolute;
        height: 1px;
        background: rgba(255, 0, 0, 0.35);
        pointer-events: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .maodie-spider { transition: none !important; }
      }
    `;
    document.head.appendChild(style);
  };

  // 状态枚举
  const STATE = {
    IDLE: 'IDLE',
    WALK: 'WALK',
    JUMP: 'JUMP',
    SCARE: 'SCARE',
    ROLL_OFF: 'ROLL_OFF'
  };

  // 蜘蛛类
  class Spider {
    constructor(world, id, platform) {
      this.world = world;
      this.id = id;
      this.scale = rand(world.config.scaleMin, world.config.scaleMax);
      this.w = Math.round(NATURAL_W * this.scale);
      this.h = Math.round(NATURAL_H * this.scale);
      this.dir = Math.random() < 0.5 ? -1 : 1; // -1 左, 1 右
      this.state = STATE.WALK;
      this.stateUntil = 0;
      this.vx = rand(world.config.speedMin, world.config.speedMax) * this.dir;
      this.vy = 0;
      this.rotation = 0;
      this.angularVel = 0;
      this.opacity = 1;
      this.grounded = false;
      this.currentPlatform = null;
      this.removed = false;

      // 初始位置：平台上随机点
      const x = rand(platform.x1 + this.w * 0.3, platform.x2 - this.w * 0.3);
      const y = platform.y - this.h * 0.5;
      this.x = x;
      this.y = y;

      // 元素
      this.el = document.createElement('div');
      this.el.className = 'maodie-spider';
      this.el.style.width = this.w + 'px';
      this.el.style.height = this.h + 'px';
      this.el.style.opacity = '1';

      const sprite = document.createElement('div');
      sprite.className = 'sprite';
      sprite.style.backgroundImage = `url("${GIF_URL}")`;
      sprite.style.backgroundSize = 'contain';
      sprite.style.backgroundRepeat = 'no-repeat';
      sprite.style.backgroundPosition = 'center center';
      this.el.appendChild(sprite);

      // 绑定事件
      this.onClick = this.onClick.bind(this);
      this.el.addEventListener('click', this.onClick);

      // 放入层
      world.layer.appendChild(this.el);

      // 初始着陆检测
      this.tryLandOnNearestPlatform();
      this.applyTransform(true);
    }

    setState(s, duration = 0) {
      if (this.state === STATE.ROLL_OFF) return; // 翻滚中不可打断
      this.state = s;
      this.stateUntil = duration > 0 ? (now() + duration * 1000) : 0;
    }

    isStateExpired(t) {
      return this.stateUntil > 0 && t >= this.stateUntil;
    }

    onClick(e) {
      e.stopPropagation();
      // 翻滚消失：禁用碰撞，快速旋转并下落，逐渐淡出
      if (this.state === STATE.ROLL_OFF) return;
      this.state = STATE.ROLL_OFF;
      this.grounded = false;
      this.currentPlatform = null;
      this.vy = rand(-200, -100); // 起跳一点
      this.vx = (this.dir * rand(80, 180));
      this.angularVel = (Math.random() < 0.5 ? -1 : 1) * rand(360, 720); // deg/s
      this.el.style.pointerEvents = 'none';
    }

    tryLandOnNearestPlatform() {
      const footX = this.x;
      const footY = this.y + this.h * 0.5;
      let best = null;
      let bestDy = Infinity;
      for (let i = 0; i < this.world.platforms.length; i++) {
        const pf = this.world.platforms[i];
        if (footX >= pf.x1 && footX <= pf.x2) {
          const dy = pf.y - footY;
          if (dy >= -8 && dy < bestDy) {
            bestDy = dy;
            best = pf;
          }
        }
      }
      if (best) {
        this.y = best.y - this.h * 0.5;
        this.vy = 0;
        this.grounded = true;
        this.currentPlatform = best;
      }
    }

    // 接近边缘尝试起跳
    maybeJumpAtEdge() {
      if (!this.grounded || !this.currentPlatform) return false;
      const pf = this.currentPlatform;
      const footX = this.x;
      const edgeDist = this.dir > 0 ? (pf.x2 - footX) : (footX - pf.x1);
      const threshold = Math.max(18, this.w * 0.25);
      if (edgeDist <= threshold) {
        if (Math.random() < 0.8) {
          const vy0 = -rand(this.world.config.jumpSpeedMin, this.world.config.jumpSpeedMax);
          this.vy = vy0;
          this.grounded = false;
          this.currentPlatform = null;
          this.setState(STATE.JUMP);
          return true;
        } else {
          this.dir *= -1;
          this.vx = Math.abs(this.vx) * this.dir;
          return false;
        }
      }
      return false;
    }

    // 鼠标靠近触发 Scare
    checkScare(mouseDoc) {
      if (this.state === STATE.ROLL_OFF) return;
      const dx = (this.x - mouseDoc.x);
      const dy = (this.y - mouseDoc.y);
      const dist = Math.hypot(dx, dy);
      if (dist <= this.world.config.scareRadius) {
        this.setState(STATE.SCARE, rand(1.0, 1.2));
      }
    }

    // 从 oldFootY 到 newFootY 跨越某平台 y 则落地
    detectLanding(oldFootY, newFootY) {
      const footX = this.x;
      let landed = null;
      let landedY = Infinity;
      for (let i = 0; i < this.world.platforms.length; i++) {
        const pf = this.world.platforms[i];
        if (footX < pf.x1 || footX > pf.x2) continue;
        const y = pf.y;
        if (oldFootY <= y && newFootY >= y) {
          if (y < landedY) {
            landedY = y;
            landed = pf;
          }
        }
      }
      return landed;
    }

    update(t, dt, mouseDoc) {
      if (this.removed) return;

      const cfg = this.world.config;
      const pageY = window.pageYOffset || document.documentElement.scrollTop || 0;

      // ROLL_OFF：翻滚坠落并淡出
      if (this.state === STATE.ROLL_OFF) {
        this.vy += cfg.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.rotation += this.angularVel * dt;
        this.opacity -= 0.9 * dt;
        if (this.opacity <= 0 || (this.y - pageY) > (window.innerHeight + 300)) {
          this.destroy('rolled_off');
          return;
        }
        this.applyTransform();
        return;
      }

      // 鼠标靠近 -> Scare
      if (mouseDoc) this.checkScare(mouseDoc);

      // 状态时间到期
      if (this.isStateExpired(t)) {
        if (this.state === STATE.SCARE) {
          this.setState(STATE.WALK);
        } else if (this.state === STATE.IDLE) {
          this.setState(STATE.WALK);
        }
      }

      // 可能进入 Idle
      if (this.state === STATE.WALK && Math.random() < cfg.idleChance * dt) {
        this.setState(STATE.IDLE, rand(cfg.idleMin, cfg.idleMax));
      }

      // 水平速度目标
      let speed = clamp(Math.abs(this.vx), cfg.speedMin, cfg.speedMax);
      if (this.state === STATE.SCARE) speed *= cfg.scareSpeedMultiplier;
      const targetVx = (this.state === STATE.IDLE ? 0 : speed * this.dir);
      this.vx = lerp(this.vx, targetVx, clamp(dt * 6, 0, 1));

      // 重力
      const wasGrounded = this.grounded;
      let oldFootY = this.y + this.h * 0.5;
      if (!this.grounded) {
        this.vy += cfg.gravity * dt;
      }

      // 移动
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // 世界边界（水平掉头）
      const docW = Math.max(document.documentElement.scrollWidth, document.documentElement.clientWidth);
      const docH = Math.max(document.documentElement.scrollHeight, document.documentElement.clientHeight);
      const halfW = this.w * 0.5, halfH = this.h * 0.5;

      if (this.x < halfW) {
        this.x = halfW;
        this.dir = 1;
        this.vx = Math.abs(this.vx);
      } else if (this.x > docW - halfW) {
        this.x = docW - halfW;
        this.dir = -1;
        this.vx = -Math.abs(this.vx);
      }

      // 落地检测
      const newFootY = this.y + halfH;
      if (!wasGrounded) {
        const landed = this.detectLanding(oldFootY, newFootY);
        if (landed) {
          this.y = landed.y - halfH;
          this.vy = 0;
          this.grounded = true;
          this.currentPlatform = landed;
          if (this.state === STATE.JUMP) this.setState(STATE.WALK);
        } else {
          this.grounded = false;
          this.currentPlatform = null;
        }
      } else {
        const pf = this.currentPlatform;
        if (pf) {
          const footX = this.x;
          const onTop = footX >= pf.x1 && footX <= pf.x2;
          const nearY = Math.abs(newFootY - pf.y) <= 4;
          if (onTop && nearY) {
            this.y = pf.y - halfH;
            this.vy = 0;
            this.grounded = true;
          } else {
            this.grounded = false;
            this.currentPlatform = null;
          }
        } else {
          const landed2 = this.detectLanding(oldFootY, newFootY);
          if (landed2) {
            this.y = landed2.y - halfH;
            this.vy = 0;
            this.grounded = true;
            this.currentPlatform = landed2;
          } else {
            this.grounded = false;
          }
        }
      }

      // 接近边缘时尝试跳跃
      if (this.state !== STATE.JUMP && this.state !== STATE.IDLE) {
        this.maybeJumpAtEdge();
      }

      // 离开页面底部 -> 触发“从顶部重生”
      // 条件：非翻滚状态，且向下坠落离开视口较远或超过文档底部
      const offBottomDoc = this.y > (docH + this.h);
      const offBottomView = (this.y - pageY) > (window.innerHeight + this.h);
      if (!this.removed && this.state !== STATE.ROLL_OFF && (offBottomDoc || offBottomView)) {
        this.destroy('fell');
        return;
      }

      // 依据水平速度方向翻转（GIF 左右移动考虑：朝左时镜像）
      const movingDir = this.vx === 0 ? this.dir : (this.vx > 0 ? 1 : -1);
      this.dir = movingDir;

      this.applyTransform();
    }

    applyTransform(initial = false) {
      const pageX = window.pageXOffset || document.documentElement.scrollLeft || 0;
      const pageY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const vx = Math.round(this.x - pageX - this.w * 0.5);
      const vy = Math.round(this.y - pageY - this.h * 0.5);
      const sx = this.dir; // 1 正常，-1 镜像
      const rot = this.rotation || 0;
      const opacity = clamp(this.opacity, 0, 1);
      this.el.style.transform = `translate3d(${vx}px, ${vy}px, 0) scaleX(${sx}) rotate(${rot}deg)`;
      if (!initial) this.el.style.opacity = String(opacity);
    }

    destroy(reason) {
      if (this.removed) return;
      this.removed = true;
      try { this.el.removeEventListener('click', this.onClick); } catch (e) {}
      if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
      this.world.onSpiderRemoved(this, reason || 'unknown');
    }
  }

  // 世界/管理器
  class World {
    constructor(config) {
      this.config = config;
      this.platforms = [];
      this.spiders = [];
      this.layer = null;
      this.debugLayer = null;
      this._raf = 0;
      this._lastT = 0;
      this._mouseDoc = { x: -1e6, y: -1e6 };
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onResize = this._onResize.bind(this);
      this._tick = this._tick.bind(this);
      this._onVisibility = this._onVisibility.bind(this);
      this._suppressRespawn = false;
      this._respawnTimer = 0;
      this._idSeq = 1;
    }

    mount() {
      injectStyleOnce(this.config.zIndex);
      // 覆盖层
      this.layer = document.createElement('div');
      this.layer.className = 'maodie-spider-layer';
      document.body.appendChild(this.layer);

      if (this.config.debug) {
        this.debugLayer = document.createElement('div');
        this.debugLayer.style.position = 'absolute';
        this.debugLayer.style.inset = '0';
        this.debugLayer.style.pointerEvents = 'none';
        this.layer.appendChild(this.debugLayer);
      }

      // 事件
      window.addEventListener('mousemove', this._onMouseMove, { passive: true });
      window.addEventListener('resize', this._onResize);
      document.addEventListener('visibilitychange', this._onVisibility);

      // 初始化
      this.rescanPlatforms();
      this.spawnSpiders(this.config.count);
      this._lastT = now();
      this._raf = requestAnimationFrame(this._tick);
    }

    unmount() {
      window.removeEventListener('mousemove', this._onMouseMove);
      window.removeEventListener('resize', this._onResize);
      document.removeEventListener('visibilitychange', this._onVisibility);
      cancelAnimationFrame(this._raf);
      this._raf = 0;
      // 清空
      this.killAll();
      if (this.layer && this.layer.parentNode) {
        this.layer.parentNode.removeChild(this.layer);
      }
      this.layer = null;
      this.debugLayer = null;
    }

    _onVisibility() {
      if (document.hidden) {
        if (this._raf) {
          cancelAnimationFrame(this._raf);
          this._raf = 0;
        }
      } else {
        if (!this._raf) {
          this._lastT = now();
          this._raf = requestAnimationFrame(this._tick);
        }
      }
    }

    _onMouseMove(e) {
      const pageX = window.pageXOffset || document.documentElement.scrollLeft || 0;
      const pageY = window.pageYOffset || document.documentElement.scrollTop || 0;
      this._mouseDoc.x = e.clientX + pageX;
      this._mouseDoc.y = e.clientY + pageY;
    }

    _onResize() {
      this.rescanPlatforms(true);
    }

    rescanPlatforms(fromResize = false) {
      this.platforms = scanPlatforms(this.config);
      if (this.config.debug) {
        this.drawDebugLines();
      }
      if (!this.platforms.length && !fromResize) {
        setTimeout(() => {
          this.platforms = scanPlatforms(this.config);
          if (this.config.debug) this.drawDebugLines();
          // 平台加载晚于脚本时，尝试补齐数量
          this.ensureCount(true);
        }, 600);
      } else {
        // 尝试补齐数量（在平台变化后）
        this.ensureCount(true);
      }
    }

    drawDebugLines() {
      if (!this.debugLayer) return;
      this.debugLayer.innerHTML = '';
      const pageX = window.pageXOffset || 0;
      const pageY = window.pageYOffset || 0;
      for (let i = 0; i < this.platforms.length; i++) {
        const p = this.platforms[i];
        const div = document.createElement('div');
        div.className = 'maodie-debug-line';
        const x1 = p.x1 - pageX;
        const x2 = p.x2 - pageX;
        const y = p.y - pageY;
        div.style.left = Math.round(x1) + 'px';
        div.style.top = Math.round(y) + 'px';
        div.style.width = Math.round(x2 - x1) + 'px';
        this.debugLayer.appendChild(div);
      }
    }

    spawnSpiders(n) {
      if (!this.platforms.length) return;
      for (let i = 0; i < n; i++) {
        const pf = sample(this.platforms);
        const sp = new Spider(this, this._idSeq++, pf);
        this.spiders.push(sp);
      }
    }

    // 从“最上面的平台”生成新的蜘蛛
    spawnAtTop(n = 1) {
      if (!this.platforms.length) return;
      const topList = this._findTopPlatforms();
      for (let i = 0; i < n; i++) {
        const pf = topList.length ? sample(topList) : sample(this.platforms);
        const sp = new Spider(this, this._idSeq++, pf);
        // 保证出生即在顶部平台上
        sp.y = pf.y - sp.h * 0.5;
        sp.applyTransform(true);
        this.spiders.push(sp);
      }
    }

    _findTopPlatforms() {
      if (!this.platforms.length) return [];
      // 平台数组按 y 已排序，取 y 最小的一簇
      const minY = this.platforms[0].y;
      const eps = 4;
      const tops = [];
      for (let i = 0; i < this.platforms.length; i++) {
        const p = this.platforms[i];
        if (p.y <= minY + eps) tops.push(p); else break;
      }
      return tops;
    }

    ensureCount(atTop = false) {
      const target = this.config.count;
      const cur = this.spiders.length;
      const missing = target - cur;
      if (missing > 0) {
        if (atTop) this.spawnAtTop(missing);
        else this.spawnSpiders(missing);
      }
    }

    onSpiderRemoved(spider, reason) {
      // 从列表移除
      const idx = this.spiders.indexOf(spider);
      if (idx >= 0) this.spiders.splice(idx, 1);

      // 维持数量：在顶部重生（点击翻滚消失、掉落离开页面等都会补齐）
      if (!this._suppressRespawn) {
        if (this._respawnTimer) clearTimeout(this._respawnTimer);
        this._respawnTimer = setTimeout(() => {
          this._respawnTimer = 0;
          this.ensureCount(true);
        }, 60);
      }
    }

    _tick() {
      const t = now();
      let dt = (t - this._lastT) / 1000;
      this._lastT = t;
      dt = clamp(dt, 0, 0.05);

      for (let i = 0; i < this.spiders.length; i++) {
        this.spiders[i].update(t, dt, this._mouseDoc);
      }
      if (this.config.debug) this.drawDebugLines();
      this._raf = requestAnimationFrame(this._tick);
    }

    killAll() {
      this._suppressRespawn = true;
      if (this._respawnTimer) {
        clearTimeout(this._respawnTimer);
        this._respawnTimer = 0;
      }
      for (let i = this.spiders.length - 1; i >= 0; i--) {
        this.spiders[i].destroy('killAll');
      }
      this.spiders = [];
      this._suppressRespawn = false;
    }

    reload() {
      // 重新扫描并重建
      this.killAll();
      this.rescanPlatforms();
      this.spawnSpiders(this.config.count);
    }
  }

  // 单例控制器
  const boot = () => {
    if (window.MaodieSpider && window.MaodieSpider._world) return;

    const config = readConfig();
    const world = new World(config);
    world.mount();

    // 暴露少量 API
    window.MaodieSpider = Object.freeze({
      version: VERSION,
      config,
      reload: () => world.reload(),
      killAll: () => world.killAll(),
      _world: world // 内部引用（只读）
    });
  };

  // 自动启动
  ready(boot);
})();