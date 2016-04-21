'use strict'

var FMM = (function() {
	var FMM = {};

	var add_field_grids = function(field1, field2, add_fn) {
		for(var cell_key in field2){
			if (field1[cell_key] === void 0) {
				field1[cell_key] = field2[cell_key];
				continue;
			};

			field1[cell_key] = add_fn(field1[cell_key], field2[cell_key]);
		}
	}
	
	// Field2
	// A class representing 2D mathmatical fields using the fast multipole method. 
	// Any data type can be used to describe point values in the field, 
	// provided appropriate values are given for  add_fn and remove_fn 
	// If add_fn and remove_fn are not defined, the field must operate on scalar numbers
	//
	// resolution 	- Distance at which two particles are treated as one 
	// range 		- Distance at which two particles can no longer interact with one another
	// value_fn		- A function that describes the field. 
	// 					This is expressed as a function of distance to a particle.
	// 					It is highly recommended this be proportionate to an inverse exponent of distance, 
	// 					e.g. function(distance) { return 1/Math.pow(distance,2) }
	FMM.Field2 = function(resolution, range, value_fn, add_fn, remove_fn) {

		function Cell (level, x,y) {
			return { level: level, x: x, y: y };
		}
		function Point (x,y,z) {
			return { x:x, y:y };
		}

		var min_level = resolution ? Math.floor(Math.log(resolution) / Math.log(2)) : 0;
		var max_level = range ? Math.floor(Math.log(range) / Math.log(2)) : 0;

		function cell_hash (cell_) {
			return cell_.level + ',' + cell_.x + ',' + cell_.y ;
		};
		function format_pos (pos) {
			if (pos.x !== void 0 && pos.y !== void 0) {
				return pos;
			};
			return Point(
				pos[0],
				pos[1]
			);
		};
		function distance (u, v) {
			return Math.sqrt(Math.pow(u.x - v.x , 2) + Math.pow(u.y - v.y, 2));
		}
		function offset (location, particle) {
			return Point(
				particle.x - location.x,
				particle.y - location.y
			);
		}
		function parent (cell) {
			return Cell(
				cell.level + 1,
				Math.floor(cell.x/2), 
				Math.floor(cell.y/2)
			);
		}
		function parents (cells) {
			var unique = {}
			for (var i = 0, li = cells.length; i < li; i++) {
				var parent_ = parent(cells[i]);
				unique[cell_hash(parent_)] = parent_;
			};
			var parents_ = [];
			for (var parent_ in unique) {
				parents_.push(unique[parent_]);
			}
			return parents_;
		}
		function children (cell) {
			var children_ = [];
			for (var i = 0; i <= 1; i++) {
				for (var j = 0; j <= 1; j++) {
					children_.push( Cell(
						cell.level - 1,
						cell.x * 2 + i,
						cell.y * 2 + j
					));
				}
			};
			return children_;
		}
		function midpoint (cell) {
			return Point(
				(cell.x + 0.5) * Math.pow(2, cell.level),
				(cell.y + 0.5) * Math.pow(2, cell.level)
			)
		}
		function cell (pos, level) {
			return Cell(
				level,
				Math.floor(pos.x / Math.pow(2, level)),
				Math.floor(pos.y / Math.pow(2, level))
			);
		}
		function cells (pos) {
			var cells_ = [];
			for (var level = min_level; level < max_level; level++) {
				cells_.push(cell(pos, level))
			};
			return cells_;
		}
		function vicinity (pos, level) {
			var center = cell(pos, level);
			var vicinity_ = [];
			for (var i = -1; i <= 1; i++) {
				for (var j = -1; j <= 1; j++) {
					vicinity_.push( Cell(
						level,
						center.x + i,
						center.y + j
					));
				}
			};
			return vicinity_;
		}
		function vicinities (pos) {
			var vicinities_ = [];
			for (var level = min_level; level < max_level; level++) {
				vicinities_.push(vicinity(pos, level))
			};
			return vicinities_;
		}
		// adds to grid the effect of a single particle
		function add_monopole_field_grid (grid, pos, options, value_fn, add_fn) {
			var cell_ = cell(pos, min_level);
			var vicinities_ = vicinities(pos);
			var excluded = {};
			excluded[cell_hash(cell_)] = cell_;
			for (var i = 0, li = vicinities_.length; i < li; i++) {
				var vicinity_ = vicinities_[i];

				var parents_ = parents(vicinity_);
				for (var j = 0, lj = parents_.length; j < lj; j++) {
					var parent_ = parents_[j];
					excluded[cell_hash(parent_)] = parent_;

					var children_ = children(parent_);
					for (var k = 0, lk = children_.length; k < lk; k++) {
						var child_ = children_[k];
						var child_key = cell_hash(child_);
						
						if (excluded[child_key] !== void 0) {
							continue;
						};

						var new_value = format_pos(value_fn(offset(midpoint(child_), pos), options));
						var old_value = grid[child_key];
						if (old_value === void 0) {
							grid[child_key] = new_value;
							continue;
						};
						grid[child_key] = add_fn(old_value, new_value);
					};
				};
			};
		}

		function add_field_grids (grid, field2, add_fn) {
			for(var cell_key in field2){
				if (grid[cell_key] === void 0) {
					grid[cell_key] = field2[cell_key];
					continue;
				};

				grid[cell_key] = add_fn(grid[cell_key], field2[cell_key]);
			}
		}

		function get_value (field, pos){
			var value = void 0;
			var cells_ = cells(pos);
			for (var i = 0, li = cells_.length; i < li; i++) {
				var cell_ = cells_[i];
				if (field[cell_hash(cell_)] === void 0) {
					continue;
				};
				if (value === void 0) {
					value = field[cell_hash(cell_)];
					continue;
				};
				value = add_fn(field[cell_hash(cell_)], value);
			};
			return value;
		}

		var this_ = {};
		this_._grid = {};
		this_.value = function (pos) {
			var value = get_value(this_._grid, format_pos(pos));
			return value;
		}
		this_.clear = function () {
			this_._grid = {};
		}
		this_.add_field = function(field) {
			add_field_grids(this_._grid, field._grid, add_fn);
		}
		this_.remove_field = function(field) {
			add_field_grids(this_._grid, field._grid, remove_fn);
		}
		this_.add_particle = function(pos, options) {
			options = options || {};
			add_monopole_field_grid(this_._grid, format_pos(pos), options, value_fn, add_fn);
		}
		this_.remove_particle = function(pos, options) {
			options = options || {};
			add_monopole_field_grid(this_._grid, format_pos(pos), options, value_fn, remove_fn);
		}
		return this_;
	}

	FMM.ScalarField2 = function(resolution, range, value_fn) {
		return FMM.Field2(resolution, range, value_fn, 
			function(u, v) { return u + v; },
			function(u, v) { return u - v; });
	}

	FMM.VectorField2 = function(resolution, range, value_fn) {
		return FMM.Field2(resolution, range, value_fn, 
			function(u, v) {
					 return {
					 	x: u.x+v.x, 
					 	y: u.y+v.y, 
					 }; 
				},
			function(u, v) {
			 		 return {
			 		 	x: u.x-v.x, 
			 		 	y: u.y-v.y, 
			 		 }; 
			 	}
		);
	}

	// Field3
	// A class representing 2D mathmatical fields using the fast multipole method. 
	// Any data type can be used to describe point values in the field, 
	// provided appropriate values are given for  add_fn and remove_fn 
	// If add_fn and remove_fn are not defined, the field must operate on scalar numbers
	//
	// resolution 	- Distance at which two particles are treated as one 
	// range 		- Distance at which two particles can no longer interact with one another
	// value_fn		- A function that describes the field. 
	// 					This is expressed as a function of distance to a particle.
	// 					It is highly recommended this be proportionate to an inverse exponent of distance, 
	// 					e.g. function(distance) { return 1/Math.pow(distance,2) }
	FMM.Field3 = function(resolution, range, value_fn, add_fn, remove_fn) {
		function Cell (level, x,y,z) {
			return { level: level, x: x, y: y, z: z };
		}
		function Point (x,y,z) {
			return { x:x, y:y, z:z };
		}

		var min_level = resolution ? Math.floor(Math.log(resolution) / Math.log(2)) : 0;
		var max_level = range ? Math.floor(Math.log(range) / Math.log(2)) : 0;

		function cell_hash (cell_) {
			return cell_.level + ',' + cell_.x + ',' + cell_.y + ',' + cell_.z;
		};
		function format_pos (pos) {
			if (pos.x !== void 0 && pos.y !== void 0 && pos.z !== void 0) {
				return pos;
			};
			return Point(
				pos[0],
				pos[1],
				pos[2]
			);
		};
		function distance (u, v) {
			return Math.sqrt(Math.pow(u.x - v.x , 2) + Math.pow(u.y - v.y, 2) + Math.pow(u.z - v.z, 2));
		}
		function offset (location, particle) {
			return Point(
				particle.x - location.x,
				particle.y - location.y,
				particle.z - location.z
			);
		}
		function parent (cell) {
			return Cell(
				cell.level + 1,
				Math.floor(cell.x/2), 
				Math.floor(cell.y/2),
				Math.floor(cell.z/2)
			);
		}
		function parents (cells) {
			var unique = {}
			for (var i = 0, li = cells.length; i < li; i++) {
				var parent_ = parent(cells[i]);
				unique[cell_hash(parent_)] = parent_;
			};
			var parents_ = [];
			for (var parent_ in unique) {
				parents_.push(unique[parent_]);
			}
			return parents_;
		}
		function children (cell) {
			var children_ = [];
			for (var i = 0; i <= 1; i++) {
				for (var j = 0; j <= 1; j++) {
					for (var k = 0; k <= 1; k++) {
						children_.push( Cell(
							cell.level - 1,
							cell.x * 2 + i,
							cell.y * 2 + j,
							cell.z * 2 + k
						));
					}
				}
			};
			return children_;
		}
		function midpoint (cell) {
			return Point(
				(cell.x + 0.5) * Math.pow(2, cell.level),
				(cell.y + 0.5) * Math.pow(2, cell.level),
				(cell.z + 0.5) * Math.pow(2, cell.level)
			)
		}
		function cell (pos, level) {
			return Cell(
				level,
				Math.floor(pos.x / Math.pow(2, level)),
				Math.floor(pos.y / Math.pow(2, level)),
				Math.floor(pos.z / Math.pow(2, level))
			);
		}
		function cells (pos) {
			var cells_ = [];
			for (var level = min_level; level < max_level; level++) {
				cells_.push(cell(pos, level))
			};
			return cells_;
		}
		function vicinity (pos, level) {
			var center = cell(pos, level);
			var vicinity_ = [];
			for (var i = -1; i <= 1; i++) {
				for (var j = -1; j <= 1; j++) {
					for (var k = -1; k <= 1; k++) {
						vicinity_.push( Cell(
							level,
							center.x + i,
							center.y + j,
							center.z + k
						));
					}
				}
			};
			return vicinity_;
		}
		function vicinities (pos) {
			var vicinities_ = [];
			for (var level = min_level; level < max_level; level++) {
				vicinities_.push(vicinity(pos, level))
			};
			return vicinities_;
		}
		// adds to grid the effect of a single particle
		function add_monopole_field_grid (grid, pos, options, value_fn, add_fn) {
			var cell_ = cell(pos, min_level);
			var vicinities_ = vicinities(pos);
			var excluded = {};
			excluded[cell_hash(cell_)] = cell_;
			for (var i = 0, li = vicinities_.length; i < li; i++) {
				var vicinity_ = vicinities_[i];

				var parents_ = parents(vicinity_);
				for (var j = 0, lj = parents_.length; j < lj; j++) {
					var parent_ = parents_[j];
					excluded[cell_hash(parent_)] = parent_;

					var children_ = children(parent_);
					for (var k = 0, lk = children_.length; k < lk; k++) {
						var child_ = children_[k];
						var child_key = cell_hash(child_);
						
						if (excluded[child_key] !== void 0) {
							continue;
						};

						var new_value = format_pos(value_fn(offset(midpoint(child_), pos), options));
						var old_value = grid[child_key];
						if (old_value === void 0) {
							grid[child_key] = new_value;
							continue;
						};
						grid[child_key] = add_fn(old_value, new_value);
					};
				};
			};
		}

		function add_field_grids (grid, field2, add_fn) {
			for(var cell_key in field2){
				if (grid[cell_key] === void 0) {
					grid[cell_key] = field2[cell_key];
					continue;
				};

				grid[cell_key] = add_fn(grid[cell_key], field2[cell_key]);
			}
		}

		function get_value (field, pos){
			var value = void 0;
			var cells_ = cells(pos);
			for (var i = 0, li = cells_.length; i < li; i++) {
				var cell_ = cells_[i];
				if (field[cell_hash(cell_)] === void 0) {
					continue;
				};
				if (value === void 0) {
					value = field[cell_hash(cell_)];
					continue;
				};
				value = add_fn(field[cell_hash(cell_)], value);
			};
			return value;
		}

		var this_ = {};
		this_._grid = {};
		this_.value = function (pos) {
			var value = get_value(this_._grid, format_pos(pos));
			return value;
		}
		this_.clear = function () {
			this_._grid = {};
		}
		this_.add_field = function(field) {
			add_field_grids(this_._grid, field._grid, add_fn);
		}
		this_.remove_field = function(field) {
			add_field_grids(this_._grid, field._grid, remove_fn);
		}
		this_.add_particle = function(pos, options) {
			options = options || {};
			add_monopole_field_grid(this_._grid, format_pos(pos), options, value_fn, add_fn);
		}
		this_.remove_particle = function(pos, options) {
			options = options || {};
			add_monopole_field_grid(this_._grid, format_pos(pos), options, value_fn, remove_fn);
		}
		return this_;
	}

	FMM.ScalarField3 = function(resolution, range, value_fn) {
		return FMM.Field3(resolution, range, value_fn, 
			function(u, v) { return u + v; },
			function(u, v) { return u - v; });
	}

	FMM.VectorField3 = function(resolution, range, value_fn) {
		return FMM.Field3(resolution, range, value_fn, 
			function(u, v) {
					 return Point(
					 	u.x+v.x, 
					 	u.y+v.y, 
					 	u.z+v.z 
					 ); 
				},
			function(u, v) {
			 		 return Point(
			 		 	u.x-v.x, 
			 		 	u.y-v.y, 
			 		 	u.z-v.z
			 		 ); 
			 	}
		);
	}

	return FMM;
})();

var THREE = THREE || {};
THREE.VectorField2 = function (resolution, range, value_fn) {
	return FMM.Field2(resolution, range, 
		function(offset, particle) {
				return value_fn(new THREE.Vector2(offset.x, offset.y), particle);
			},
		function(u, v) {
				return THREE.Vector2.addVectors( u, v );
			},
		function(u, v) {
				return THREE.Vector2.subVectors( u, v );
		 	}
	);		
}
THREE.VectorField3 = function (resolution, range, value_fn) {
	return FMM.Field3(resolution, range, 
		function(offset, particle) {
			return value_fn(new THREE.Vector3(offset.x, offset.y, offset.z), particle);
		},
		function(u, v) {
				return new THREE.Vector3().addVectors( u, v );
			},
		function(u, v) {
				return new THREE.Vector3().subVectors( u, v );
		 	}
	);	
}
