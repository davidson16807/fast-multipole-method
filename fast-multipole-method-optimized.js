'use strict'

 var FMM = (function() {
	var FMM = {};

    // Field3
	// A class representing 3D mathmatical fields using the fast multipole method. 
	// This class makes certain assumptions about data types in order to optimize for performance.
	//
	// resolution 	- Distance at which two particles are treated as one 
	// range 		- Distance at which two particles can no longer interact with one another
	// value_fn		- A function that describes the field. 
	// 					This is expressed as a function of distance to a particle.
	// 					It is highly recommended this be proportionate to an inverse exponent of distance, 
	// 					e.g. function(distance) { return 1/Math.pow(distance,2) }
	FMM.Field3 = function(resolution, range, value_fn) {
		var N = 3; // number of dimensions, always constant

		function Cell (level, x,y,z) {
			return { level: level, x: x, y: y, z: z };
		}
		function Point (x,y,z) {
			return { x:x, y:y, z:z };
		}

		function midpoint (cell) {
			var cell_size = range / ( 1 << cell.level );
			return Point(
				(cell.x + 0.5) * cell_size - 0.5 * range,
				(cell.y + 0.5) * cell_size - 0.5 * range,
				(cell.z + 0.5) * cell_size - 0.5 * range,
			);
		}

		function cell_hash (cell_) {
			return 			 (1 << (N*cell_.level))
                 + cell_.x * (1 << (2*cell_.level))
                 + cell_.y * (1 << (1*cell_.level))
                 + cell_.z;
		};

		var min_level = 1; 
		var max_level = Math.ceil(Math.log(range/resolution) / Math.log(2)) + 1; 

		if (max_level > 9) {
			throw 'grid consumes too much memory! try adjusting resolution or range parameters'
		}

		var max_hash_size = 1 << (N*max_level);
		var _grid = {
			x: new Float32Array(max_hash_size),
			y: new Float32Array(max_hash_size),
			z: new Float32Array(max_hash_size),
		};

		function distance (u, v) {
			return Math.sqrt((u.x - v.x )*(u.x - v.x ) + (u.y - v.y)*(u.y - v.y) + (u.z - v.z)*(u.z - v.z));
		}
		function offset (location, particle) {
			return Point(
				particle.x - location.x,
				particle.y - location.y,
				particle.z - location.z
			);
		}
		function equals(a, b) {
			return a.x == b.x && 
			       a.y == b.y && 
			       a.z == b.z &&
			       a.level == b.level;
		}
		function is_out_of_bounds(cell) {
			var cell_num = 1 << cell.level;

			return !(	0 <= cell.x && cell.x < cell_num
					&& 	0 <= cell.y && cell.y < cell_num
					&& 	0 <= cell.z && cell.z < cell_num	 );
		}
		function children(cell_) {
			var level = cell_.level + 1;
			var x = 2*cell_.x;
			var y = 2*cell_.y;
			var z = 2*cell_.z;
			return [
				Cell(level, 	x, 		y, 		z 	),
				Cell(level, 	x+1, 	y, 		z 	),
				Cell(level, 	x, 		y+1,	z 	),
				Cell(level, 	x, 		y, 		z+1	),
				Cell(level, 	x+1,	y+1,	z 	),
				Cell(level, 	x, 		y+1, 	z+1	),
				Cell(level, 	x+1, 	y, 		z+1 ),
				Cell(level, 	x+1, 	y+1, 	z+1 ),
			];
		}
		function cell (pos, level) {
			var cell_size = range / ( 1 << level );
			var cell_x = (pos.x + 0.5 * range) / (cell_size);
			var cell_y = (pos.y + 0.5 * range) / (cell_size);
			var cell_z = (pos.z + 0.5 * range) / (cell_size);

			var floor_x = Math.floor(cell_x);
			var floor_y = Math.floor(cell_y);
			var floor_z = Math.floor(cell_z);

			return Cell(level, floor_x, floor_y, floor_z);
		}
		function cells (pos) {
			var cells_ = [];
			var cell_;
			for (var level = min_level; level < max_level; level++) {
				cell_ = cell(pos, level);
				if (!is_out_of_bounds(cell_)) {
					cells_.push(cell_);
				}
			};
			return cells_;
		}
		function vicinities (pos) {
			var cells_ = cells(pos);
			var vicinities_ = [];
			var cell_ = Cell(0, 0,0,0);
			// for each cell in cells_, find the children of that cell that aren't occupied by pos
			for (var cell_i = 1; cell_i < cells_.length; cell_i++) {
				var occupied_ = cells_[cell_i];
				var children_ = children(cell_);
				for (var child_i = 0; child_i < children_.length; child_i++) {
					var child_ = children_[child_i];

					if (!equals(child_, occupied_) && !is_out_of_bounds(child_)) {
						vicinities_.push(child_);
					}
				}

				cell_ = occupied_;
			}
			return vicinities_;
		}

		// adds to grid the effect of a single particle
		function add_monopole_field_grid (grid, pos, charge, value_fn) {
			var x = grid.x;
			var y = grid.y;
			var z = grid.z;
			var vicinities_ = vicinities(pos);
			for (var i = 0, li = vicinities_.length; i < li; i++) {

				var cell_ = vicinities_[i];
				var cell_hash_ = cell_hash(cell_);

				var new_value = value_fn(offset(midpoint(cell_), pos), charge);
				
				x[cell_hash_] += new_value.x;
				y[cell_hash_] += new_value.y;
				z[cell_hash_] += new_value.z; 

			}
		}

		function add_field_grids (field1, field2) {
			var x1 = field1.x;
			var y1 = field1.y;
			var z1 = field1.z;

			var x2 = field2.x;
			var y2 = field2.y;
			var z2 = field2.z;

			for (var i = 0, li = x.length; i < li; i++) {
				x1[i] += x2[i];
				y1[i] += y2[i];
				z1[i] += z2[i];
			}
		}

		function get_value (field, pos, out){
			var x = field.x;
			var y = field.y;
			var z = field.z;

			var ox = 0;
			var oy = 0;
			var oz = 0;

			var cells_ = cells(pos);
			var cell_ = cells_[0];
			var cell_hash_ = 0;
			for (var i = 0, li = cells_.length; i < li; i++) {
				cell_ = cells_[i];
				cell_hash_ = cell_hash(cell_);
				ox += x[cell_hash_];
				oy += y[cell_hash_];
				oz += z[cell_hash_];
			};

			out.x = ox;
			out.y = oy;
			out.z = oz;
			return out;
		}

		function print(field, level) {
			var x = field.x;
			var y = field.y;
			var z = field.z;
			var cell_num = 1 << level;
			console.log('level ' + level + ':')
			for (var k = 0; k < cell_num; k++) {
				console.log(k + ':')
				var line = '';
				for (var i = 0; i < cell_num; i++) {
					for (var j = 0; j < cell_num; j++) {
						var cell_ = Cell(level, i, j, k);
						var cell_hash_ = cell_hash(cell_);
						var magnitude = x[cell_hash_]*x[cell_hash_] 
						              + y[cell_hash_]*y[cell_hash_] 
						              + z[cell_hash_]*z[cell_hash_];
						var ref = 0.01;
						line += magnitude > ref? '▓' : magnitude > ref/10? '▒': magnitude > ref/100? '░':' ';
					}
					line += '\n'
				}
				console.log(line);
			}
		}

		var this_ = {};
		this_._grid = _grid; // NOTE: this is exposed for debugging purposes, only
		this_.value = function (pos, out) {
			out = out || Point(0,0,0);
			return get_value(_grid, pos, out);
		}
		this_.clear = function () {
			_grid.x.fill(0);
			_grid.y.fill(0);
			_grid.z.fill(0);
		}
		// this_.add_field = function(field) {
		// 	add_field_grids(_grid, field._grid, add_fn);
		// }
		// this_.remove_field = function(field) {
		// 	add_field_grids(_grid, field._grid, remove_fn);
		// }
		this_.add_particle = function(pos, charge) {
			add_monopole_field_grid(_grid, pos,  charge, value_fn );
		}
		this_.remove_particle = function(pos, charge) {
			add_monopole_field_grid(_grid, pos, -charge, value_fn );
		}
		this_.print = function(level) {
			print(_grid, level);
		}
		return this_;
	}


return FMM; })();

//var gravitational_constant = 1;
//var field = FMM.Field3(1, 10, function(offset, charge) { 
//	var distance = Math.sqrt( offset.x*offset.x + offset.y*offset.y + offset.z*offset.z );// console.log(offset, particle);
//	var acceleration = gravitational_constant * charge / Math.pow(distance, 2)
//	var normalized = {
//		x: offset.x / distance,
//		y: offset.y / distance,
//		z: offset.z / distance,
//	};
//	return {
//		x: normalized.x * acceleration,
//		y: normalized.y * acceleration, 
//		z: normalized.z * acceleration
//	};
//})
//
//field.add_particle({x:1,y:0,z:0}, 1);
//console.log(field.value({x:3,y:0,z:0}));
//