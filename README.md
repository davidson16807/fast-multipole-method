# fast-multipole-method.js
This is a javascript implementation for the [fast multipole method](https://en.wikipedia.org/wiki/Fast_multipole_method)

## What does it try to solve?
Let's say you want simulate the solar system. You'll recall all objects in the universe effect one another through gravity, right? A naive simulator might simulate this as follows:

    for every object in the universe:
    	for every other object in the universe:
    		calculate the force exerted between the objects

The simulation above doesn't scale very well as we increase the number of objects. If I want to simulate 3 objects I have to make 6 calculations per timestep. If I want to simulate 4 objects I have to make 12 calculations per timestep - I doubled the number of calculations just by adding one object! Things get out of hand quickly. What I really want is for the number of calculations to increase *in direct proportion* to the number of objects.

Well, if I want that so badly, why don't I do it this way:

    for every object in the universe:
    	for every location in the universe:
    		calculate the force exerted by the object from that location and store it in a grid somewhere
    
The "grid" we mention is an approximation for what physicists call a [field](). For every point on a field, there is a corresponding value. Sometimes, that value is a scalar, like a floating point number. Sometimes, that value is a vector, which might express something like force or an acceleration. Gravity, for instance, can be represented by a field of vectors, each one expressing the acceleration one would experience at a specific location.

Now it's true the solution above scales well with the number of objects, but it does not scale well with the size of the grid. If I want to simulate a universe that's 3 grid cells wide I have to make 9 calculations for each object. If I want to simulate a universe that's 4 grid cells wide I have to make 16 calculations for each object. Again, things get out of hand quickly. What we really need is a simulation that scales well for both the number of objects *and* the size of the grid.

Some video games solve this by limiting the amount of interaction. Objects have to fall within a certain range before they can interact with one another. We can reuse our grid for this implementation - if two objects occupy adjacent grid cells, we can assume the objects are within range. There's still a few problems with this approach, though. It doesn't work well for really massive objects. Also, if too many objects occupy the same grid cell, we're back to same problem we had in our first solution.

## How does it try to solve it?
The solution relies upon an observation. As you move away from an object, its force of gravity becomes less noticeable, and accuracy comes to matter less. This is because gravity follows an [inverse square law](https://en.wikipedia.org/wiki/Inverse-square_law). There comes a point when the forces are so small they no longer seem to matter. The only thing that matters anymore is their general order of magnitude. 

This means we can represent gravity by a sort of "nested grid," along the same lines as a [quadtree](https://en.wikipedia.org/wiki/Quadtree) or [octree](https://en.wikipedia.org/wiki/Octree). For each object we look at the grid cells adjacent to the one that houses the object. Each grid cell gets a value assigned to it, and this value represents the force exerted on every object within the grid cell. The simulator now looks something like this:

	for every object in the universe:
		for every level in the nested grid:
			for every neighboring grid cell within the level:
				calculate the force between the object and the midpoint of the grid cell

This is known as the [fast multipole method](https://en.wikipedia.org/wiki/Fast_multipole_method). The number of grid cells we deal with remains constant for each object. This means the number of calculations will scale linearly with the number of objects. This is exactly what we want. 

## How do I use it:

Let's say you want simulate the solar system in 2D. To start, you'll want something to represent your gravitational field. This requires a 2D vector field where every point represents the acceleration feld 

And here's an example:
