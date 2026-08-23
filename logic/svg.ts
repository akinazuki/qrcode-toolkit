interface SvgShape {
  fill: string
  rule?: CanvasFillRule
  d?: string
  rect?: [number, number, number, number]
}

function f(n: number) {
  return Math.round(n * 100) / 100
}

/**
 * A minimal drawing context implementing the subset of the Canvas 2D API
 * used by the QR Code renderer, recording the shapes as SVG elements.
 */
export class SvgContext {
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000'
  strokeStyle: string | CanvasGradient | CanvasPattern = 'none'

  private shapes: SvgShape[] = []
  private d = ''
  private cx: number | undefined
  private cy: number | undefined
  private startX = 0
  private startY = 0

  beginPath() {
    this.d = ''
    this.cx = undefined
    this.cy = undefined
  }

  moveTo(x: number, y: number) {
    this.d += `M${f(x)} ${f(y)}`
    this.cx = this.startX = x
    this.cy = this.startY = y
  }

  lineTo(x: number, y: number) {
    if (this.cx == null) {
      this.moveTo(x, y)
      return
    }
    this.d += `L${f(x)} ${f(y)}`
    this.cx = x
    this.cy = y
  }

  closePath() {
    this.d += 'Z'
    this.cx = this.startX
    this.cy = this.startY
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
    const sx = x + radius * Math.cos(startAngle)
    const sy = y + radius * Math.sin(startAngle)

    if (this.cx == null)
      this.moveTo(sx, sy)
    else if (Math.abs(this.cx - sx) > 1e-6 || Math.abs(this.cy! - sy) > 1e-6)
      this.lineTo(sx, sy)

    const r = f(radius)
    if (Math.abs(endAngle - startAngle) >= Math.PI * 2 - 1e-9) {
      // Full circle: split into two arcs
      const mx = x + radius * Math.cos(startAngle + Math.PI)
      const my = y + radius * Math.sin(startAngle + Math.PI)
      this.d += `A${r} ${r} 0 1 1 ${f(mx)} ${f(my)}A${r} ${r} 0 1 1 ${f(sx)} ${f(sy)}`
      this.cx = sx
      this.cy = sy
    }
    else {
      const ex = x + radius * Math.cos(endAngle)
      const ey = y + radius * Math.sin(endAngle)
      const delta = endAngle - startAngle
      const large = Math.abs(delta) > Math.PI ? 1 : 0
      const sweep = delta > 0 ? 1 : 0
      this.d += `A${r} ${r} 0 ${large} ${sweep} ${f(ex)} ${f(ey)}`
      this.cx = ex
      this.cy = ey
    }
  }

  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number) {
    if (this.cx == null) {
      this.moveTo(x1, y1)
      return
    }
    const x0 = this.cx
    const y0 = this.cy!

    const v1x = x0 - x1
    const v1y = y0 - y1
    const v2x = x2 - x1
    const v2y = y2 - y1
    const cross = v1x * v2y - v1y * v2x
    const l1 = Math.hypot(v1x, v1y)
    const l2 = Math.hypot(v2x, v2y)

    // Degenerate cases: collinear points or zero radius
    if (Math.abs(cross) < 1e-9 || radius <= 0 || l1 < 1e-9 || l2 < 1e-9) {
      this.lineTo(x1, y1)
      return
    }

    const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (l1 * l2)))
    const angle = Math.acos(cos)
    const dist = radius / Math.tan(angle / 2)

    const t1x = x1 + (v1x / l1) * dist
    const t1y = y1 + (v1y / l1) * dist
    const t2x = x1 + (v2x / l2) * dist
    const t2y = y1 + (v2y / l2) * dist

    this.lineTo(t1x, t1y)
    const sweep = cross < 0 ? 1 : 0
    this.d += `A${f(radius)} ${f(radius)} 0 0 ${sweep} ${f(t2x)} ${f(t2y)}`
    this.cx = t2x
    this.cy = t2y
  }

  fill(rule?: CanvasFillRule) {
    if (!this.d)
      return
    this.shapes.push({
      fill: String(this.fillStyle),
      rule,
      d: this.d,
    })
  }

  fillRect(x: number, y: number, w: number, h: number) {
    this.shapes.push({
      fill: String(this.fillStyle),
      rect: [x, y, w, h],
    })
  }

  toSVG(width: number, height: number, background?: string): string {
    const body: string[] = []
    if (background)
      body.push(`<rect width="${f(width)}" height="${f(height)}" fill="${background}"/>`)

    for (const shape of this.shapes) {
      const { fill } = shape
      if (fill === 'transparent' || fill === 'none')
        continue
      // Light-colored shapes only ever paint over the background,
      // so they can be safely merged into the background rect
      if (background && fill === background)
        continue
      if (shape.rect) {
        const [x, y, w, h] = shape.rect
        body.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}"/>`)
      }
      else if (shape.d) {
        const rule = shape.rule === 'evenodd' ? ' fill-rule="evenodd"' : ''
        body.push(`<path d="${shape.d}" fill="${fill}"${rule}/>`)
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(width)}" height="${f(height)}" viewBox="0 0 ${f(width)} ${f(height)}">${body.join('')}</svg>`
  }
}
