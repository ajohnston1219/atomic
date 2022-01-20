var Atomic = (function(document, window) {
    // shim layer with setTimeout fallback
    window.requestAnimFrame = (function() {
        return window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function(callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    })();

    function color2Str(rgba) {
        return 'rgba(' + rgba[0] + ',' + rgba[1] + ',' + rgba[2] + ',' + rgba[3] + ')';
    }

    function Circle(r, x, y, xdot, ydot, options) {
        this._r = r;
        this._x = x;
        this._y = y;
        this._xdot = xdot;
        this._ydot = ydot;
        this._a = 0.0;
        this._isAcc = false;
        this._arms = [];
        this._hits = [];
        this._options = options;

        this.distance = function(other) {
            return Math.sqrt(
                (this._x - other._x) * (this._x - other._x)
                    + (this._y - other._y) * (this._y - other._y)
            );
        }

        this.vmag = function() {
            return Math.sqrt(this._xdot * this._xdot + this._ydot * this._ydot);
        }

        this.intersection = function(other) {
            var doesIntersect = this.distance(other) <= (2 * this._r);
            if (doesIntersect) {
                var xrel = other._x - this._x;
                var yrel = other._y - this._y;
                var theta = Math.atan2(yrel, xrel);
                var xint = r * Math.cos(theta);
                var yint = r * Math.sin(theta);
                return [xint, yint, other._xdot, other._ydot];
            }
            return null;
        }

        this.arm = function(other) {
            var hasArm = this.distance(other) <= this._options.armlen;
            if (hasArm) {
                this._arms.push(other);
                var xrel = other._x - this._x;
                var yrel = other._y - this._y;
                var theta = Math.atan2(yrel, xrel);
                var c = Math.cos(theta);
                var s = Math.sin(theta);
                var x1 = this._x + r * c;
                var y1 = this._y + r * s;
                var x2 = other._x - r * c;
                var y2 = other._y - r * s;
                return [x1, y1, x2, y2];
            }
            return null;
        }

        this.inArms = function(other) {
            return this._arms.some(a => a === other);
        }

        this.clearArms = function() {
            this._arms = [];
        }

        this.hasHit = function(other) {
            return this._hits.some(a => a === other);
        }

        this.clearHits = function() {
            this._hits = [];
        }

        this.collisions = function(atoms) {
            for (let i = 0; i < this._options.numAtoms; ++i) {
                if (atoms[i] === this) {
                    continue;
                }
                if (!atoms[i].hasHit(this)) {
                    var intersection = this.intersection(atoms[i]);
                    if (intersection) {
                        this._hits.push(atoms[i]);
                        var newV = (this.vmag() + atoms[i].vmag()) / 2.0;
                        var vx = newV * intersection[0] / this._r;
                        var vy = newV * intersection[1] / this._r;
                        this._xdot = -vx;
                        this._ydot = -vy;
                        atoms[i]._xdot = vx;
                        atoms[i]._ydot = vy;
                    }
                }
            }
        }

        this.mouseEffect = function(mousepos, moving, clicked) {
            var xrel = mousepos[0] - this._x;
            var yrel = mousepos[1] - this._y;
            var mouseDist = Math.sqrt(xrel * xrel + yrel * yrel);
            if (moving && mouseDist <= this._options.mouser) {
                var theta = Math.atan2(yrel, xrel);
                var vx = this._options.mousev * Math.cos(theta);
                var vy = this._options.mousev * Math.sin(theta);
                this._xdot = -vx;
                this._ydot = -vy;
            }
            if (clicked && mouseDist <= this._options.clickr) {
                this._a = this._options.amax;
                this._isAcc = true;
            }
        }

        this.render = function(dt, ctx) {
            var vtheta = Math.atan2(this._ydot, this._xdot);
            if (this._isAcc) {
                var ax = this._a * Math.cos(vtheta);
                var ay = this._a * Math.sin(vtheta);
                this._xdot += dt * ax;
                this._ydot += dt * ay;
                if (this._a > -this._options.amax) {
                    this._a -= dt * this._options.jerk;
                } else {
                    this._isAcc = false;
                    this._a = 0.0;
                }
            }
            if (this.vmag() > (this._options.vmax)) {
                this._isAcc = true;
                this._a = 0.0;
            }
            this._x += dt * this._xdot;
            this._y += dt * this._ydot;
            if ((this._x + r) >= this._options.xmax && this._xdot > 0.0) {
                this._xdot = -this._xdot;
            }
            if ((this._x - r) <= 0.0 && this._xdot < 0.0) {
                this._xdot = -this._xdot;
            }
            if ((this._y + r) >= this._options.ymax && this._ydot > 0.0) {
                this._ydot = -this._ydot;
            }
            if ((this._y - r) <= 0.0 && this._ydot < 0.0) {
                this._ydot = -this._ydot;
            }
            ctx.fillStyle = color2Str(this._options.atomColor);
            ctx.strokeStyle = color2Str(this._options.atomColor);
            ctx.beginPath();
            ctx.arc(this._x, this._y, this._r, 0.0, 2*Math.PI);
            ctx.fill();
            ctx.stroke();
        }.bind(this);

        this.renderArms = function(ctx, atoms) {
            for (let i = 0; i < this._options.numAtoms; ++i) {
                if (atoms[i] === this) {
                    continue;
                }
                var arm = this.arm(atoms[i]);
                if (!atoms[i].inArms(this)) {
                    if (arm) {
                        var alpha = this._options.armColor[3] * (1.0 - this.distance(atoms[i]) / this._options.armlen);
                        var color = [this._options.armColor[0], this._options.armColor[1], this._options.armColor[2], alpha];
                        ctx.strokeStyle = color2Str(color);
                        ctx.beginPath();
                        ctx.moveTo(arm[0], arm[1]);
                        ctx.lineTo(arm[2], arm[3]);
                        ctx.stroke();
                    }
                }
            }
        }.bind(this);
    }

    // Settings
    var defaultOptions = {
        numAtoms: 500,
        atomColor: [155, 0, 255, 0.5],
        armColor: [200, 0, 155, 0.3],
        r: 2.0,
        vmax: 3.0,
        armlen: 100.0,
        mouser: 100.0,
        mousev: 3.0,
        clickr: 300.0,
        amax: 3.0,
        jerk: 1.0
    }

    function Atomic(options) {
        // Options
        this._options = defaultOptions;
        if (options) {
            Object.keys(options).forEach(function(k) {
                this._options[k] = options[k];
            }.bind(this));
        }

        // Initialize canvas
        this._container = document.getElementById('atomic');
        this._canvas = document.createElement('canvas');
        this._canvas.width = this._container.clientWidth;
        this._canvas.height = this._container.clientHeight;
        this._container.appendChild(this._canvas);
        this._ctx = this._canvas.getContext('2d');
        this._xmax = this._canvas.width;
        this._ymax = this._canvas.height;

        // Mouse events
        this._moving = false;
        this._clicked = false;
        this._mousepos = [0.0, 0.0];
        var that = this;
        document.addEventListener('mousemove', function(e) {
            that._moving = true;
            if (e.originalEvent) {
                e = e.originalEvent;
            }
            var rect = that._canvas.getBoundingClientRect();
            that._mousepos[0] = e.clientX - rect.left;
            that._mousepos[1] = e.clientY - rect.top;
            setTimeout(function() {
                that._moving = false;
            }, 1000);
        });

        document.addEventListener('click', function(e) {
            var rect = that._canvas.getBoundingClientRect();
            that._mousepos[0] = e.clientX - rect.left;
            that._mousepos[1] = e.clientY - rect.top;
            that._clicked = true;
        });


        this._options.xmax = this._xmax;
        this._options.ymax = this._ymax;

        // Generate atoms
        this._atoms = new Array(this._options.numAtoms);
        for (var i = 0; i < this._options.numAtoms; ++i) {
            var x = Math.random() * this._xmax;
            var y = Math.random() * this._ymax;
            var xdot = Math.random() * this._options.vmax;
            var ydot = Math.random() * this._options.vmax;
            this._atoms[i] = new Circle(this._options.r, x, y, xdot, ydot, this._options);
        }

        // Render function
        this._dt = 1 / 10;
        this._draw = function() {
            for (var i = 0; i < this._options.numAtoms; ++i) {
                this._atoms[i].clearArms();
                this._atoms[i].clearHits();
            }
            for (var i = 0; i < this._options.numAtoms; ++i) {
                this._atoms[i].mouseEffect(this._mousepos, this._moving, this._clicked);
                this._clicked = false;
            }
            for (var i = 0; i < this._options.numAtoms; ++i) {
                this._atoms[i].collisions(this._atoms);
            }
            for (var i = 0; i < this._options.numAtoms; ++i) {
                this._atoms[i].renderArms(this._ctx, this._atoms);
            }
            for (var i = 0; i < this._options.numAtoms; ++i) {
                this._atoms[i].render(this._dt, this._ctx);
            }
        }.bind(this);

        (function render() {
            that._ctx.clearRect(0, 0, that._canvas.width, that._canvas.height);
            that._draw();
            window.requestAnimFrame(render);
        })();
    }

    return Atomic;

})(document, window);
