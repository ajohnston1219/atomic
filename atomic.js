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

    var container = document.getElementById('atomic');
    var canvas = document.createElement('canvas');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var xmax = canvas.width;
    var ymax = canvas.height;
    var clicked = false;
    var mousepos = [0.0, 0.0];

    function color2Str(rgba) {
        return 'rgba(' + rgba[0] + ',' + rgba[1] + ',' + rgba[2] + ',' + rgba[3] + ')';
    }

    document.addEventListener('mousemove', function(e) {
        if (e.originalEvent) {
            e = e.originalEvent;
        }
        var rect = canvas.getBoundingClientRect();
        mousepos[0] = e.clientX - rect.left;
        mousepos[1] = e.clientY - rect.top;
    });

    document.addEventListener('click', function(e) {
        var rect = canvas.getBoundingClientRect();
        mousepos[0] = e.clientX - rect.left;
        mousepos[1] = e.clientY - rect.top;
        clicked = true;
    });

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

        this.mouseEffect = function() {
            var xrel = mousepos[0] - this._x;
            var yrel = mousepos[1] - this._y;
            var mouseDist = Math.sqrt(xrel * xrel + yrel * yrel);
            if (mouseDist <= this._options.mouser) {
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
            if (this.vmag() > (2 * this._options.vmax)) {
                this._isAcc = true;
                this._a = 0.0;
            }
            this._x += dt * this._xdot;
            this._y += dt * this._ydot;
            if ((this._x + r) >= xmax && this._xdot > 0.0) {
                this._xdot = -this._xdot;
            }
            if ((this._x - r) <= 0.0 && this._xdot < 0.0) {
                this._xdot = -this._xdot;
            }
            if ((this._y + r) >= ymax && this._ydot > 0.0) {
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
        vmax: 30.0,
        armlen: 100.0,
        mouser: 10.0,
        mousev: 30.0,
        clickr: 300.0,
        amax: 30.0,
        jerk: 6.0
    }

    function Atomic(options) {
        this._options = defaultOptions;
        if (options) {
            Object.keys(options).forEach(function(k) {
                this._options[k] = options[k];
            });
        }

        // Generate atoms
        this._atoms = new Array(this._options.numAtoms);
        for (var i = 0; i < this._options.numAtoms; ++i) {
            var x = Math.random() * xmax;
            var y = Math.random() * ymax;
            var xdot = Math.random() * this._options.vmax;
            var ydot = Math.random() * this._options.vmax;
            this._atoms[i] = new Circle(this._options.r, x, y, xdot, ydot, this._options);
        }

        // Render function
        this._dt = 1 / 10;
        this._draw = function(ctx) {
            for (var i = 0; i < this._options.numAtoms; ++i) {
                this._atoms[i].clearArms();
                this._atoms[i].clearHits();
            }
            for (var i = 0; i < this._options.numAtoms; ++i) {
                this._atoms[i].mouseEffect();
            }
            for (var i = 0; i < this._options.numAtoms; ++i) {
                this._atoms[i].collisions(this._atoms);
            }
            for (var i = 0; i < this._options.numAtoms; ++i) {
                this._atoms[i].renderArms(ctx, this._atoms);
            }
            for (var i = 0; i < this._options.numAtoms; ++i) {
                this._atoms[i].render(this._dt, ctx);
            }
            clicked = false;
        }.bind(this);

        var that = this;
        (function render() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            that._draw(ctx);
            window.requestAnimFrame(render);
        })();
    }

    return Atomic;

})(document, window);
