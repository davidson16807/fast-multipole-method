# fast-multipole-method.js
This is a javascript implementation for the [fast multipole method](https://en.wikipedia.org/wiki/Fast_multipole_method)

## What does it try to solve?
Let's say you want simulate the solar system. You'll recall all objects in the universe effect one another through gravity. A naive simulator might simulate this as follows:

    for every object in the universe:
    	for every other object in the universe:
    		calculate the force exerted between the objects

This is a task with O(N^2) complexity. If I want to simulate 3 objects I have to make 6 calculations per timestep. If I want to simulate 10 objects I have to make 90 calculations per timestep. Things quickly gets out of hand. What I really want is a task with O(N) complexity - I want the number of calculations to scale linearly with the number of objects.

A better approach might be to limit interaction, so objects have to fall within a certain range. You can setup a grid to keep track of when this happens. If two objects occupy adjacent grid cells, they're within range. 

There's still a problem with this approach, though. It doesn't work for really massive objects that would normally influence objects outside their grid cell. Also, if there's too many objects in the same grid cell, we're back to same problem we encountered earlier when we were making a bunch of calculations.

## How does it try to solve it?
The solution relies upon an observation. As you move away from an object, its force of gravity becomes less noticeable. This is because gravity follows an [inverse square law](https://en.wikipedia.org/wiki/Inverse-square_law). There comes a point when the forces are so small they no longer seem to matter. The only thing that matters anymore is their general order of magnitude. 

This means we can represent gravity by a sort of "nested grid," along the same lines as a [quadtree](https://en.wikipedia.org/wiki/Quadtree) or [octree](https://en.wikipedia.org/wiki/Octree). For each object we look at the grid cells adjacent to the one that houses the object. Each grid cell gets a value assigned to it, and this value represents the force exerted on every object within the grid cell. The simulator now looks something like this:

	for every object in the universe:
		for every level in the nested grid:
			for every neighboring grid cell within the level:
				calculate the force between the object and the midpoint of the grid cell

This is known as the [fast multipole method](https://en.wikipedia.org/wiki/Fast_multipole_method). The number of grid cells we deal with remains constant for each object. This means the number of calculations will scale linearly with the number of objects. This is exactly what we want. 
