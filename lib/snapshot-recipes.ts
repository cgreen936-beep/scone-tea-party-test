import type { IngredientRequirement, RecipeMatrixItem } from "@/lib/mock-data";

function ing(
  name: string,
  amountPerUnit: number,
  unit: IngredientRequirement["unit"],
  packSize: number,
  packLabel: string,
): IngredientRequirement {
  return { name, amountPerUnit, unit, packSize, packLabel, morrisonsUrl: "" };
}

function recipe(
  itemId: string,
  itemName: string,
  ingredients: IngredientRequirement[],
  sandwichesPerUnit?: number,
): RecipeMatrixItem {
  return { itemId, itemName, ingredients, sandwichesPerUnit };
}

/** £ per kg. Recipe amounts stay in grams. */
function kg(name: string, grams: number): IngredientRequirement {
  return ing(name, grams, "g", 1000, `${name} per kg`);
}

/** £ per 100g. Used for pastes, spreads, spices, and small jars. */
function per100(name: string, grams: number): IngredientRequirement {
  return ing(name, grams, "g", 100, `${name} per 100g`);
}

/** £ per litre. Recipe amounts stay in ml. */
function litre(name: string, ml: number): IngredientRequirement {
  return ing(name, ml, "ml", 1000, `${name} per litre`);
}

/** £ per single item: one egg, one loaf, one pastry sheet, one bag. */
function each(name: string, count: number, unit: "units" | "loaves" = "units"): IngredientRequirement {
  return ing(name, count, unit, 1, `${name} each`);
}

const thickLoaf = (amount: number) => each("Thick White Bread Loaf", amount, "loaves");
const seededLoaf = (amount: number) => each("Seeded Bread Loaf", amount, "loaves");
const farmhouseLoaf = (amount: number) => each("Farmhouse Bread Loaf", amount, "loaves");
const softLoaf = (amount: number) => each("Soft White Bread Loaf", amount, "loaves");
const gfLoaf = (amount: number) => each("Gluten Free Bread Loaf", amount, "loaves");
const butter = (amount: number) => kg("Unsalted Butter", amount);
const cheddar = (amount: number) => kg("Mature Cheddar", amount);
const ham = (amount: number) => kg("Honey Roast Ham", amount);
const flour = (amount: number) => kg("Self-Raising Flour", amount);
const sugar = (amount: number) => kg("Caster Sugar", amount);
const eggs = (amount: number) => each("Free Range Egg", amount);
const jam = (amount: number) => per100("Strawberry Jam", amount);
const cream = (amount: number) => kg("Cornish Clotted Cream", amount);
const tray = () => ing("Catering Platter Tray & Wrap", 1, "units", 1, "Catering Platter Tray and Film Wrap");
const liner = () => ing("Pastry Liner & Box", 1, "units", 1, "Bakery Box and Greaseproof Liner");
const puff = (amount: number) => each("Puff Pastry Sheet", amount);

export const SNAPSHOT_RECIPES: RecipeMatrixItem[] = [
  recipe("05261f77-5dd2-480d-a82e-2787cc0d09ba", "Extra Large Classic Sandwich Platter", [
    seededLoaf(1),
    farmhouseLoaf(1),
    butter(180),
    ham(220),
    cheddar(180),
    eggs(3),
    litre("Mayonnaise", 80),
    kg("Tuna", 150),
    kg("Cucumber", 80),
    kg("Cherry Tomatoes", 60),
    per100("English Mustard", 20),
    tray(),
  ], 10),
  recipe("d13672f8-50d1-4c7a-9709-601354f28010", "Small Classic Sandwich Platter", [
    thickLoaf(1),
    butter(60),
    ham(80),
    cheddar(70),
    eggs(1),
    litre("Mayonnaise", 40),
    kg("Tuna", 60),
    kg("Cucumber", 40),
    per100("English Mustard", 10),
    tray(),
  ], 5),
  recipe("snapshot:large-vegetarian-sandwich-platter", "Large Vegetarian Sandwich Platter", [
    thickLoaf(2),
    butter(120),
    cheddar(180),
    kg("Cream Cheese", 120),
    eggs(2),
    litre("Mayonnaise", 40),
    kg("Cucumber", 80),
    kg("Cherry Tomatoes", 80),
    kg("Pickles", 40),
    tray(),
  ], 10),
  recipe("d3110813-7bf4-4d18-b2f0-5f39f4e66719", "Gluten Free Sandwich Platter", [
    gfLoaf(1.5),
    kg("Dairy Free Spread", 90),
    cheddar(120),
    ham(100),
    eggs(1),
    litre("Mayonnaise", 40),
    kg("Cherry Tomatoes", 80),
    kg("Cucumber", 60),
    tray(),
  ], 8),
  recipe("snapshot:childrens-sandwich-platter", "Children's Sandwich Platter", [
    softLoaf(1),
    butter(60),
    jam(80),
    kg("Mild Cheddar", 70),
    ham(60),
    kg("Cucumber", 40),
    tray(),
  ], 5),
  recipe("snapshot:bread-bun-sandwich-platter", "Bread Bun Sandwich Platter", [
    each("Soft White Bread Bun", 12),
    butter(120),
    ham(180),
    cheddar(150),
    eggs(2),
    litre("Mayonnaise", 60),
    kg("Tuna", 100),
    kg("Cucumber", 70),
    tray(),
  ], 12),
  recipe("snapshot:brioche-baguette-sandwich-platter", "Brioche Baguette Sandwich Platter", [
    each("Brioche Roll", 8),
    butter(100),
    ham(140),
    cheddar(120),
    kg("Brie", 80),
    kg("Cherry Tomatoes", 80),
    kg("Cucumber", 50),
    litre("Mayonnaise", 40),
    tray(),
  ], 8),
  recipe("snapshot:brunch-bagel-sandwich-box", "Brunch Bagel Sandwich Box", [
    each("Plain Bagel", 8),
    kg("Cream Cheese", 200),
    kg("Streaky Bacon", 120),
    eggs(2),
    kg("Cherry Tomatoes", 80),
    ing("Box & Liner", 1, "units", 1, "Sandwich Box and Liner"),
  ], 8),
  recipe("b22d540e-4c09-4882-90bf-4f02784b3d11", "Pork Sausage Rolls", [
    puff(0.5),
    kg("Pork Sausage Meat", 450),
    kg("Brown Onion", 30),
    eggs(0.5),
    liner(),
  ]),
  recipe("snapshot:christmas-sausage-rolls", "Christmas Sausage Rolls", [
    puff(0.5),
    kg("Pork Sausage Meat", 400),
    per100("Cranberry Sauce", 50),
    eggs(0.5),
    liner(),
  ]),
  recipe("snapshot:cheese-and-onion-rolls", "Cheese and Onion Rolls", [
    each("Shortcrust Pastry Sheet", 1),
    cheddar(200),
    kg("Brown Onion", 100),
    per100("English Mustard", 15),
    liner(),
  ]),
  recipe("snapshot:homemade-quiche", "Homemade Quiche", [
    each("Shortcrust Pastry Sheet", 1),
    eggs(4),
    litre("Double Cream", 150),
    litre("Whole Milk", 100),
    cheddar(200),
    ham(80),
    kg("Brown Onion", 60),
  ]),
  recipe("snapshot:pork-pie-selection", "Pork Pie Selection", [
    kg("Pork Sausage Meat", 480),
    each("Shortcrust Pastry Sheet", 2),
    eggs(1),
    per100("Caramelised Onion Chutney", 80),
    liner(),
  ]),
  recipe("snapshot:cheesy-garlic-pinwheels", "Cheesy Garlic Pinwheels", [
    puff(0.5),
    cheddar(180),
    butter(40),
    per100("Garlic Puree", 15),
    liner(),
  ]),
  recipe("snapshot:spiced-vegan-pinwheels", "Spiced Vegan Pinwheels", [
    each("Vegan Puff Pastry Sheet", 0.5),
    kg("Roasted Red Peppers", 80),
    kg("Chickpeas", 60),
    kg("Vegan Cheese", 40),
    kg("Baby Spinach", 20),
    liner(),
  ]),
  recipe("692ddbc9-a009-4691-b87e-1bf8ae481bb2", "Classic Grazing Platter", [
    cheddar(140),
    kg("Brie", 80),
    kg("Chorizo", 60),
    kg("Salami", 50),
    kg("Serrano Ham", 50),
    kg("Hot Honey Chorizo", 40),
    kg("Water Crackers", 80),
    kg("Red Grapes", 100),
    kg("Strawberries", 40),
    per100("Caramelised Onion Chutney", 30),
    tray(),
  ]),
  recipe("snapshot:simple-savoury-grazing-platter", "Simple Savoury Grazing Platter", [
    cheddar(100),
    kg("Brie", 60),
    kg("Chorizo", 50),
    kg("Water Crackers", 90),
    kg("Hummus", 80),
    kg("Olives", 40),
    kg("Cherry Tomatoes", 70),
    kg("Pickles", 40),
    tray(),
  ]),
  recipe("snapshot:small-vegan-grazing-platter", "Small Vegan Grazing Platter", [
    kg("Vegan Cheese", 90),
    kg("Hummus", 90),
    kg("Water Crackers", 70),
    kg("Cucumber", 70),
    kg("Carrots", 70),
    kg("Cherry Tomatoes", 50),
    kg("Olives", 40),
    kg("Red Grapes", 40),
    kg("Roasted Red Peppers", 40),
    kg("Pea Shoots", 15),
    tray(),
  ]),
  recipe("snapshot:small-cheese-box", "Small Cheese Box", [
    cheddar(150),
    kg("Brie", 80),
    kg("Water Crackers", 70),
    per100("Caramelised Onion Chutney", 30),
    each("Cheese Box", 1),
  ]),
  recipe("snapshot:large-salad-selection-box", "Large Salad Selection Box", [
    kg("Rocket", 80),
    each("Little Gem Lettuce", 2),
    kg("Cherry Tomatoes", 120),
    kg("Cucumber", 100),
    kg("Carrots", 50),
    kg("Olives", 30),
    kg("Pea Shoots", 20),
    litre("Salad Dressing", 40),
    each("Salad Box", 1),
  ]),
  recipe("snapshot:classic-crisp-box", "Classic Crisp Box", [
    each("Ready Salted Crisps", 12),
    each("Crisp Display Box", 1),
  ]),
  recipe("snapshot:party-crisp-selection", "Party Crisp Selection", [
    each("Ready Salted Crisps", 6),
    each("Cheese and Onion Crisps", 5),
    each("Salt and Vinegar Crisps", 5),
    each("Crisp Display Box", 1),
  ]),
  recipe("snapshot:sweet-chilli-topped-crisps", "Sweet Chilli Topped Crisps", [
    each("Sweet Chilli Crisps", 12),
    each("Crisp Box", 1),
  ]),
  recipe("7423d8e8-7a70-4f73-b586-9cd3bcff3b76", "Biscoff Traybake Cake", [
    flour(250),
    butter(200),
    sugar(200),
    eggs(3),
    per100("Biscoff Spread", 140),
    kg("Biscoff Biscuits", 80),
    kg("Icing Sugar", 50),
    ing("Traybake Liner & Box", 1, "units", 1, "Traybake Liner and Box"),
  ]),
  recipe("snapshot:christmas-cupcakes", "Christmas Cupcakes", [
    flour(200),
    butter(200),
    sugar(150),
    eggs(2),
    kg("Icing Sugar", 150),
    per100("Mixed Spice", 8),
    each("Christmas Cupcake Topper", 12),
    each("Cupcake Case", 12),
    ing("Cupcake Box", 1, "units", 1, "Cupcake Box 12"),
  ]),
  recipe("snapshot:selection-of-cupcakes", "Selection of Cupcakes", [
    flour(200),
    butter(180),
    sugar(150),
    eggs(2),
    per100("Cocoa Powder", 25),
    kg("Icing Sugar", 150),
    each("Cupcake Case", 12),
    ing("Cupcake Box", 1, "units", 1, "Cupcake Box 12"),
  ]),
  recipe("snapshot:classic-rocky-road", "Classic Rocky Road", [
    kg("Milk Chocolate", 180),
    kg("Dark Chocolate", 120),
    butter(60),
    per100("Golden Syrup", 40),
    kg("Marshmallows", 100),
    kg("Digestive Biscuits", 120),
    liner(),
  ]),
  recipe("snapshot:orange-crunch-tiffin", "Orange Crunch Tiffin", [
    kg("Milk Chocolate", 200),
    per100("Orange Marmalade", 80),
    butter(60),
    per100("Golden Syrup", 40),
    kg("Digestive Biscuits", 180),
    kg("Oreos", 40),
    liner(),
  ]),
  recipe("snapshot:mixed-box-of-pastries", "Mixed Box of Pastries", [
    puff(2),
    butter(40),
    kg("Dark Chocolate", 50),
    jam(40),
    eggs(1),
    ing("Pastry Box", 1, "units", 1, "Pastry Box"),
  ]),
  recipe("0c5e1611-5679-4000-a6e4-bcd0aa50c9c5", "Vegan Sandwich Platter", [
    thickLoaf(2),
    kg("Dairy Free Spread", 120),
    kg("Hummus", 200),
    kg("Roasted Red Peppers", 120),
    kg("Vegan Cheese", 120),
    kg("Cucumber", 80),
    kg("Cherry Tomatoes", 80),
    kg("Falafel", 80),
    kg("Pea Shoots", 20),
    tray(),
  ], 10),
  recipe("snapshot:small-vegetarian-sandwich-platter", "Small Vegetarian Sandwich Platter", [
    thickLoaf(1),
    butter(60),
    cheddar(80),
    kg("Cream Cheese", 60),
    eggs(1),
    litre("Mayonnaise", 25),
    kg("Cucumber", 50),
    kg("Cherry Tomatoes", 50),
    tray(),
  ], 5),
  recipe("snapshot:extra-large-vegetarian-sandwich-platter", "Extra Large Vegetarian Sandwich Platter", [
    seededLoaf(1),
    farmhouseLoaf(1),
    butter(180),
    cheddar(250),
    kg("Cream Cheese", 180),
    eggs(3),
    litre("Mayonnaise", 60),
    kg("Cucumber", 120),
    kg("Cherry Tomatoes", 120),
    kg("Carrots", 80),
    kg("Pickles", 40),
    tray(),
  ], 10),
  recipe("snapshot:deli-meats-grazing-platter", "Deli Meats Grazing Platter", [
    kg("Cooked Ham", 80),
    ham(70),
    kg("Serrano Ham", 50),
    kg("Salami", 40),
    kg("Chorizo", 35),
    kg("Hot Honey Chorizo", 25),
    cheddar(120),
    kg("Brie", 80),
    kg("Water Crackers", 100),
    per100("Caramelised Onion Chutney", 50),
    kg("Red Grapes", 80),
    kg("Olives", 40),
    tray(),
  ]),
  recipe("snapshot:cheese-and-tomato-pastry-pinwheels", "Cheese and Tomato Pastry Pinwheels", [
    puff(0.5),
    cheddar(150),
    kg("Cherry Tomatoes", 100),
    liner(),
  ]),
  recipe("snapshot:open-scones-with-cream-and-jam", "Open Scones with Cream and Jam", [
    flour(400),
    butter(100),
    litre("Whole Milk", 120),
    eggs(1),
    cream(150),
    jam(150),
  ]),
  recipe("snapshot:one-flavour-scone-platter", "One Flavour Scone Platter", [
    flour(500),
    butter(125),
    litre("Whole Milk", 150),
    eggs(1),
    cream(200),
    jam(170),
  ]),
  recipe("snapshot:christmas-traybake-cake", "Christmas Traybake Cake", [
    flour(275),
    butter(275),
    sugar(350),
    eggs(4),
    per100("Mixed Spice", 15),
    kg("Dried Cranberries", 40),
    kg("Icing Sugar", 100),
    ing("Traybake Liner & Box", 1, "units", 1, "Traybake Liner and Box"),
  ]),
  recipe("snapshot:mixed-traybake-platter", "Mixed Traybake Platter", [
    flour(300),
    butter(250),
    sugar(300),
    eggs(4),
    per100("Cocoa Powder", 30),
    per100("Lemon Curd", 40),
    kg("Icing Sugar", 80),
    ing("Traybake Liner & Box", 1, "units", 1, "Traybake Liner and Box"),
  ]),
  recipe("snapshot:simple-salad-box", "Simple Salad Box", [
    kg("Rocket", 40),
    each("Little Gem Lettuce", 1),
    kg("Cherry Tomatoes", 80),
    kg("Cucumber", 70),
    kg("Carrots", 30),
    litre("Salad Dressing", 20),
    each("Salad Box", 1),
  ]),
  recipe("snapshot:scotch-egg-selection", "Scotch Egg Selection", [
    eggs(6),
    kg("Pork Sausage Meat", 300),
    kg("Breadcrumbs", 80),
    liner(),
  ]),
  recipe("snapshot:crudites-grazing-platter", "Crudites Grazing Platter", [
    kg("Carrots", 150),
    kg("Cucumber", 120),
    kg("Red Pepper", 80),
    kg("Cherry Tomatoes", 50),
    kg("Hummus", 150),
    litre("Mint Yogurt Dip", 50),
    tray(),
  ]),
  recipe("snapshot:homemade-pigs-in-blankets", "Homemade Pigs in Blankets", [
    kg("Chipolata Sausages", 400),
    kg("Streaky Bacon", 200),
    liner(),
  ]),
  recipe("snapshot:bbq-chicken-drumsticks", "BBQ Chicken Drumsticks", [
    kg("Chicken Drumsticks", 800),
    litre("BBQ Sauce", 80),
    tray(),
  ]),
  recipe("snapshot:garlic-and-herb-chicken-drumsticks", "Garlic and Herb Chicken Drumsticks", [
    kg("Chicken Drumsticks", 800),
    butter(50),
    per100("Garlic Puree", 20),
    per100("Dried Mixed Herbs", 5),
    tray(),
  ]),
  recipe("snapshot:sweet-treats-selection-box", "Sweet Treats Selection Box", [
    kg("Digestive Biscuits", 80),
    kg("Oreos", 60),
    kg("Milk Chocolate", 70),
    kg("Dark Chocolate", 50),
    kg("Strawberries", 40),
    kg("Blueberries", 30),
    kg("Fudge", 40),
    each("Sweet Treat Box", 1),
  ]),
  recipe("d8308752-a134-42b5-95c6-12ba9602a88f", "Classic Afternoon Tea", [
    thickLoaf(0.5),
    butter(40),
    ham(40),
    cheddar(30),
    flour(200),
    litre("Whole Milk", 60),
    eggs(1),
    cream(50),
    jam(40),
    tray(),
  ], 4),
];
