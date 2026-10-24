import type { FoodCategory, MenuItem, PortionSize } from "../types";

/**
 * Chain-wide hero items, compiled from chains' public menus (October 2026).
 *
 * Accuracy rules:
 *  - Item names/descriptions/composition: `reported` (public menu), not location-verified.
 *  - Prices: TYPICAL US RANGES, status `estimate`. Franchisees set prices, and delivery
 *    menus are usually marked up, so the UI always says "Est." and links out for the real price.
 *    An admin can record a verified per-location price which then takes precedence.
 *  - Calories only where the chain publishes a stable figure; otherwise omitted.
 *  - Allergens / dietary claims are intentionally empty: we can't verify cross-contact.
 */

interface SeedOpts {
  desc?: string;
  ingr?: string[];
  combo?: [number, number];
  isCombo?: boolean;
  kcal?: number;
}

type Seed = [key: string, chainId: string, name: string, category: FoodCategory, est: [number, number], portion: PortionSize, opts?: SeedOpts];

const CATALOG_DATE = "2026-10-01T00:00:00Z";

const SEEDS: Seed[] = [
  // McDonald's
  ["mcd-big-mac", "mcdonalds", "Big Mac", "burgers", [5.29, 6.99], "regular", { desc: "Two beef patties, special sauce, lettuce, cheese, pickles and onions on a sesame seed bun.", ingr: ["beef", "cheese", "lettuce", "pickles", "onion", "special sauce"], combo: [9.49, 11.99], kcal: 590 }],
  ["mcd-qpc", "mcdonalds", "Quarter Pounder with Cheese", "burgers", [5.99, 7.49], "regular", { desc: "Quarter-pound fresh beef patty with two slices of cheese, onions, pickles, ketchup and mustard.", ingr: ["beef", "cheese", "onion", "pickles"], combo: [9.99, 12.29], kcal: 520 }],
  ["mcd-dqpc", "mcdonalds", "Double Quarter Pounder with Cheese", "burgers", [7.49, 9.29], "large", { desc: "Two quarter-pound beef patties stacked with cheese, onions and pickles.", ingr: ["beef", "cheese", "onion", "pickles"], combo: [11.29, 13.79] }],
  ["mcd-nuggets-10", "mcdonalds", "10 pc Chicken McNuggets", "chicken", [5.49, 6.99], "regular", { desc: "Ten tempura-battered white meat nuggets with your choice of dipping sauce.", ingr: ["chicken"], combo: [9.29, 11.49], kcal: 410 }],
  ["mcd-mccrispy", "mcdonalds", "McCrispy", "chicken", [5.29, 6.79], "regular", { desc: "Crispy Southern-style chicken fillet with crinkle-cut pickles on a potato roll.", ingr: ["chicken", "pickles"], combo: [9.29, 11.49] }],
  ["mcd-egg-mcmuffin", "mcdonalds", "Egg McMuffin", "breakfast", [4.29, 5.29], "snack", { desc: "Freshly cracked egg, Canadian bacon and American cheese on a toasted English muffin.", ingr: ["egg", "ham", "cheese"], kcal: 310 }],
  ["mcd-fries", "mcdonalds", "World Famous Fries (Medium)", "sides", [3.29, 4.49], "snack", { desc: "Thin-cut golden fries.", ingr: ["potato"] }],
  ["mcd-mcflurry-oreo", "mcdonalds", "McFlurry with OREO Cookies", "desserts", [4.29, 5.29], "snack", { desc: "Vanilla soft serve blended with OREO cookie pieces.", ingr: ["soft serve", "oreo"] }],

  // Chick-fil-A
  ["cfa-sandwich", "chick-fil-a", "Chick-fil-A Chicken Sandwich", "chicken", [5.29, 6.49], "regular", { desc: "Boneless breast of chicken, pressure-cooked in peanut oil, with dill pickle chips on a toasted buttered bun.", ingr: ["chicken", "pickles"], combo: [9.29, 10.99], kcal: 420 }],
  ["cfa-spicy-deluxe", "chick-fil-a", "Spicy Deluxe Sandwich", "chicken", [6.29, 7.49], "regular", { desc: "Spicy chicken breast with lettuce, tomato and pepper jack cheese on a toasted bun.", ingr: ["chicken", "pepper jack", "lettuce", "tomato", "spicy"], combo: [10.29, 11.99] }],
  ["cfa-nuggets-8", "chick-fil-a", "Chick-fil-A Nuggets (8 ct)", "chicken", [5.29, 6.49], "snack", { desc: "Bite-sized pieces of boneless chicken breast, breaded and pressure-cooked.", ingr: ["chicken"], combo: [9.29, 10.99], kcal: 250 }],
  ["cfa-grilled-nuggets-12", "chick-fil-a", "Grilled Nuggets (12 ct)", "chicken", [7.49, 8.99], "regular", { desc: "Bite-sized pieces of grilled, marinated chicken breast.", ingr: ["chicken", "grilled"] }],
  ["cfa-cobb", "chick-fil-a", "Cobb Salad", "salads", [9.99, 11.49], "large", { desc: "Mixed greens with nuggets, roasted corn, Monterey Jack and cheddar, bacon, egg and grape tomatoes.", ingr: ["chicken", "bacon", "egg", "cheese", "corn", "lettuce", "tomato"] }],
  ["cfa-waffle-fries", "chick-fil-a", "Waffle Potato Fries (Medium)", "sides", [2.69, 3.49], "snack", { desc: "Waffle-cut potatoes cooked in canola oil.", ingr: ["potato"] }],

  // Taco Bell
  ["tb-crunchwrap", "taco-bell", "Crunchwrap Supreme", "tacos", [4.99, 6.29], "regular", { desc: "Seasoned beef, nacho cheese sauce, a crunchy tostada shell, sour cream, lettuce and tomato, grilled in a flour tortilla.", ingr: ["beef", "nacho cheese", "sour cream", "lettuce", "tomato"], combo: [8.99, 10.49], kcal: 530 }],
  ["tb-mexican-pizza", "taco-bell", "Mexican Pizza", "mexican", [5.49, 6.49], "regular", { desc: "Two crispy shells layered with seasoned beef and refried beans, topped with pizza sauce, three-cheese blend and tomatoes.", ingr: ["beef", "beans", "cheese", "tomato"] }],
  ["tb-cgc", "taco-bell", "Cheesy Gordita Crunch", "tacos", [3.99, 5.29], "snack", { desc: "A crunchy taco wrapped in a warm flatbread with a layer of melted cheese, seasoned beef and spicy ranch.", ingr: ["beef", "cheese", "spicy ranch", "lettuce"] }],
  ["tb-chalupa", "taco-bell", "Chalupa Supreme", "tacos", [3.99, 4.99], "snack", { desc: "Fried chalupa shell with seasoned beef, reduced-fat sour cream, lettuce, three-cheese blend and tomatoes.", ingr: ["beef", "sour cream", "cheese", "lettuce", "tomato"] }],
  ["tb-nachos-bellgrande", "taco-bell", "Nachos BellGrande", "mexican", [5.49, 6.49], "shareable", { desc: "Tortilla chips topped with nacho cheese sauce, seasoned beef, refried beans, sour cream and tomatoes.", ingr: ["beef", "beans", "nacho cheese", "sour cream", "tomato"] }],
  ["tb-cantina-bowl", "taco-bell", "Cantina Chicken Bowl", "bowls", [7.49, 8.99], "regular", { desc: "Slow-roasted chicken over seasoned rice and black beans with guacamole, avocado ranch, pico de gallo and lettuce.", ingr: ["chicken", "rice", "black beans", "guacamole", "pico de gallo"] }],

  // Wendy's
  ["wen-daves-single", "wendys", "Dave's Single", "burgers", [6.29, 7.49], "regular", { desc: "Quarter-pound fresh beef with American cheese, lettuce, tomato, pickle, ketchup, mayo and onion.", ingr: ["beef", "cheese", "lettuce", "tomato", "pickles", "onion"], combo: [9.99, 11.79] }],
  ["wen-daves-double", "wendys", "Dave's Double", "burgers", [7.49, 8.79], "large", { desc: "Two quarter-pound fresh beef patties with cheese, lettuce, tomato, pickle and onion.", ingr: ["beef", "cheese", "lettuce", "tomato", "pickles", "onion"], combo: [10.99, 12.99] }],
  ["wen-baconator", "wendys", "Baconator", "burgers", [8.29, 9.79], "large", { desc: "Two quarter-pound beef patties, six strips of Applewood smoked bacon, American cheese, ketchup and mayo.", ingr: ["beef", "bacon", "cheese"], combo: [11.79, 13.79] }],
  ["wen-spicy-chicken", "wendys", "Spicy Chicken Sandwich", "chicken", [6.49, 7.49], "regular", { desc: "Spicy breaded chicken breast with lettuce, tomato and mayo.", ingr: ["chicken", "spicy", "lettuce", "tomato"], combo: [9.99, 11.49] }],
  ["wen-frosty", "wendys", "Chocolate Frosty (Medium)", "desserts", [2.29, 3.29], "snack", { desc: "Wendy's signature thick frozen dessert.", ingr: ["frozen dessert", "chocolate"] }],

  // Burger King
  ["bk-whopper", "burger-king", "Whopper", "burgers", [5.99, 7.29], "regular", { desc: "Flame-grilled beef patty with tomatoes, lettuce, mayo, ketchup, pickles and onions on a sesame seed bun.", ingr: ["beef", "lettuce", "tomato", "pickles", "onion", "flame-grilled"], combo: [9.49, 11.49], kcal: 670 }],
  ["bk-bacon-king", "burger-king", "Bacon King", "burgers", [8.99, 10.49], "large", { desc: "Two flame-grilled beef patties, thick-cut bacon, American cheese, ketchup and mayo.", ingr: ["beef", "bacon", "cheese", "flame-grilled"], combo: [11.99, 13.99] }],
  ["bk-royal-crispy", "burger-king", "Royal Crispy Chicken", "chicken", [6.29, 7.49], "regular", { desc: "Crispy white meat chicken fillet with savory sauce, lettuce and tomato on a potato bun.", ingr: ["chicken", "lettuce", "tomato"] }],
  ["bk-chicken-fries", "burger-king", "Chicken Fries (9 pc)", "chicken", [4.99, 5.99], "snack", { desc: "Breaded white meat chicken shaped like fries.", ingr: ["chicken"] }],
  ["bk-impossible", "burger-king", "Impossible Whopper", "burgers", [6.99, 8.29], "regular", { desc: "Flame-grilled plant-based Impossible patty with Whopper toppings. Prepared on shared equipment.", ingr: ["plant-based patty", "lettuce", "tomato", "pickles", "onion"] }],

  // Popeyes
  ["pop-sandwich", "popeyes", "Classic Chicken Sandwich", "chicken", [5.49, 6.49], "regular", { desc: "Buttermilk-battered chicken breast with pickles and mayo on a toasted brioche bun.", ingr: ["chicken", "pickles", "brioche"], combo: [9.49, 10.99], kcal: 700 }],
  ["pop-3pc", "popeyes", "3 pc Signature Chicken Combo", "chicken", [10.49, 12.49], "large", { desc: "Three pieces of bone-in fried chicken, a regular side and a biscuit.", ingr: ["chicken", "biscuit"], isCombo: true }],
  ["pop-tenders-5", "popeyes", "5 pc Chicken Tenders", "chicken", [9.49, 11.49], "large", { desc: "Five hand-battered chicken tenders with dipping sauce.", ingr: ["chicken", "tenders"] }],
  ["pop-cajun-fries", "popeyes", "Cajun Fries (Regular)", "sides", [2.99, 3.79], "snack", { desc: "Fries with Cajun seasoning.", ingr: ["potato", "cajun"] }],

  // Raising Cane's
  ["cane-box", "raising-canes", "The Box Combo", "chicken", [11.99, 13.49], "large", { desc: "Four chicken fingers, crinkle-cut fries, Cane's sauce, Texas toast, coleslaw and a regular drink.", ingr: ["chicken", "tenders", "potato", "texas toast", "coleslaw"], isCombo: true }],
  ["cane-3-finger", "raising-canes", "The 3 Finger Combo", "chicken", [9.99, 11.49], "regular", { desc: "Three chicken fingers, crinkle-cut fries, Cane's sauce, Texas toast and a regular drink.", ingr: ["chicken", "tenders", "potato", "texas toast"], isCombo: true }],
  ["cane-caniac", "raising-canes", "The Caniac Combo", "chicken", [17.99, 20.49], "shareable", { desc: "Six chicken fingers, crinkle-cut fries, two Cane's sauces, Texas toast, coleslaw and a large drink.", ingr: ["chicken", "tenders", "potato", "texas toast", "coleslaw"], isCombo: true }],
  ["cane-sandwich", "raising-canes", "The Sandwich Combo", "chicken", [10.99, 12.49], "regular", { desc: "Three chicken fingers on a toasted bun with Cane's sauce and lettuce, plus fries and a drink.", ingr: ["chicken", "tenders", "potato"], isCombo: true }],

  // In-N-Out
  ["ino-double-double", "in-n-out", "Double-Double", "burgers", [4.99, 6.49], "regular", { desc: "Two beef patties and two slices of American cheese with lettuce, tomato and spread, onions optional.", ingr: ["beef", "cheese", "lettuce", "tomato", "onion", "spread"], combo: [8.99, 10.79], kcal: 610 }],
  ["ino-cheeseburger", "in-n-out", "Cheeseburger", "burgers", [3.29, 4.29], "snack", { desc: "Beef patty with American cheese, lettuce, tomato and spread.", ingr: ["beef", "cheese", "lettuce", "tomato", "spread"] }],
  ["ino-animal-fries", "in-n-out", "Animal Style Fries", "sides", [4.29, 5.49], "regular", { desc: "Fresh-cut fries with melted cheese, spread and grilled onions (from the not-so-secret menu).", ingr: ["potato", "cheese", "grilled onion", "spread"] }],
  ["ino-dd-animal", "in-n-out", "Double-Double Animal Style", "burgers", [5.29, 6.79], "regular", { desc: "Double-Double with mustard-cooked patties, extra spread, pickles and grilled onions.", ingr: ["beef", "cheese", "pickles", "grilled onion", "spread"] }],

  // Whataburger
  ["wb-whataburger", "whataburger", "Whataburger", "burgers", [6.49, 7.49], "regular", { desc: "Quarter-pound beef patty on a toasted five-inch bun with mustard, lettuce, tomato, pickles and onions.", ingr: ["beef", "lettuce", "tomato", "pickles", "onion"], combo: [10.29, 11.99] }],
  ["wb-patty-melt", "whataburger", "Whataburger Patty Melt", "burgers", [7.49, 8.99], "large", { desc: "Two beef patties, grilled onions, Monterey Jack and creamy pepper sauce on Texas toast.", ingr: ["beef", "cheese", "grilled onion", "texas toast"], combo: [10.99, 12.79] }],
  ["wb-hbcb", "whataburger", "Honey Butter Chicken Biscuit", "breakfast", [4.99, 5.99], "regular", { desc: "Crispy chicken strips drizzled with honey butter sauce on a buttermilk biscuit.", ingr: ["chicken", "biscuit", "honey butter"] }],
  ["wb-whatachickn", "whataburger", "Whatachick'n Sandwich", "chicken", [6.79, 7.99], "regular", { desc: "Breaded chicken breast with lettuce, tomato and mayo on a toasted bun.", ingr: ["chicken", "lettuce", "tomato"] }],

  // Chipotle
  ["chp-chicken-bowl", "chipotle", "Chicken Burrito Bowl", "bowls", [9.75, 11.75], "large", { desc: "Adobo-marinated grilled chicken over cilantro-lime rice and beans with your choice of salsas and toppings.", ingr: ["chicken", "rice", "beans", "salsa"] }],
  ["chp-steak-burrito", "chipotle", "Steak Burrito", "mexican", [10.75, 12.75], "large", { desc: "Grilled steak wrapped in a flour tortilla with rice, beans, salsa and toppings.", ingr: ["steak", "rice", "beans", "salsa", "tortilla"] }],
  ["chp-carnitas-tacos", "chipotle", "Carnitas Tacos (3)", "tacos", [9.75, 11.75], "regular", { desc: "Three tacos with braised pork carnitas and your choice of salsas.", ingr: ["pork", "salsa", "tortilla"] }],
  ["chp-quesadilla", "chipotle", "Chicken Quesadilla", "mexican", [10.25, 12.25], "large", { desc: "Grilled flour tortilla with melted cheese and chicken, served with three sides.", ingr: ["chicken", "cheese", "tortilla"] }],
  ["chp-chips-guac", "chipotle", "Chips & Guacamole", "sides", [4.95, 6.25], "snack", { desc: "Lime-salted tortilla chips with hand-mashed guacamole.", ingr: ["tortilla chips", "guacamole"] }],

  // Subway
  ["sub-bmt", "subway", "Italian B.M.T. (Footlong)", "sandwiches", [9.49, 11.49], "large", { desc: "Genoa salami, spicy pepperoni and Black Forest ham with your choice of cheese and veggies.", ingr: ["salami", "pepperoni", "ham", "cheese"] }],
  ["sub-turkey", "subway", "Oven-Roasted Turkey (6 inch)", "sandwiches", [6.49, 7.99], "regular", { desc: "Sliced turkey with your choice of bread, cheese and veggies.", ingr: ["turkey"] }],
  ["sub-steak-cheese", "subway", "Steak & Cheese (Footlong)", "sandwiches", [10.49, 12.49], "large", { desc: "Shaved steak with melted cheese, peppers and onions.", ingr: ["steak", "cheese", "peppers", "onion"] }],
  ["sub-meatball", "subway", "Meatball Marinara (Footlong)", "sandwiches", [8.49, 10.49], "large", { desc: "Italian-style meatballs in marinara with melted cheese.", ingr: ["meatballs", "marinara", "cheese"] }],

  // Jack in the Box
  ["jib-jumbo-jack", "jack-in-the-box", "Jumbo Jack", "burgers", [4.49, 5.79], "regular", { desc: "Beef patty with lettuce, tomato, onion, pickles, mayo and ketchup on a sesame seed bun.", ingr: ["beef", "lettuce", "tomato", "onion", "pickles"], combo: [8.49, 10.29] }],
  ["jib-sourdough-jack", "jack-in-the-box", "Sourdough Jack", "burgers", [6.49, 7.79], "regular", { desc: "Beef patty, bacon, Swiss-style and American cheese, tomato and mayo on toasted sourdough.", ingr: ["beef", "bacon", "cheese", "tomato", "sourdough"], combo: [9.99, 11.79] }],
  ["jib-tacos", "jack-in-the-box", "2 Tacos", "tacos", [2.29, 2.99], "snack", { desc: "Two crispy deep-fried tacos with seasoned filling, American cheese, lettuce and taco sauce.", ingr: ["taco", "cheese", "lettuce"] }],
  ["jib-curly-fries", "jack-in-the-box", "Seasoned Curly Fries (Medium)", "sides", [3.29, 4.29], "snack", { desc: "Seasoned spiral-cut fries.", ingr: ["potato"] }],

  // KFC
  ["kfc-8pc", "kfc", "8 pc Bucket", "chicken", [19.99, 25.99], "shareable", { desc: "Eight pieces of bone-in chicken, Original Recipe or Extra Crispy.", ingr: ["chicken"] }],
  ["kfc-famous-bowl", "kfc", "Famous Bowl", "bowls", [5.99, 7.49], "regular", { desc: "Mashed potatoes, sweet corn, crispy chicken, home-style gravy and a three-cheese blend.", ingr: ["chicken", "mashed potatoes", "corn", "gravy", "cheese"] }],
  ["kfc-sandwich", "kfc", "KFC Chicken Sandwich", "chicken", [5.99, 6.99], "regular", { desc: "Extra crispy chicken filet with pickles and mayo on a brioche-style bun.", ingr: ["chicken", "pickles", "brioche"] }],
  ["kfc-tenders-combo", "kfc", "3 pc Tenders Combo", "chicken", [9.99, 11.49], "regular", { desc: "Three tenders with a side, a biscuit, a dipping sauce and a drink.", ingr: ["chicken", "tenders", "biscuit"], isCombo: true }],

  // Panda Express
  ["pnd-orange-chicken-plate", "panda-express", "Plate: Orange Chicken + Beijing Beef", "asian", [10.49, 12.49], "large", { desc: "Two entrées — Orange Chicken and Beijing Beef — with your choice of side.", ingr: ["chicken", "beef", "orange sauce", "rice"], isCombo: true }],
  ["pnd-bowl", "panda-express", "Bowl: Orange Chicken with Chow Mein", "asian", [8.99, 10.49], "regular", { desc: "One entrée of Orange Chicken over chow mein.", ingr: ["chicken", "noodles", "orange sauce"] }],
  ["pnd-honey-walnut", "panda-express", "Honey Walnut Shrimp Bowl", "seafood", [10.49, 12.49], "regular", { desc: "Tempura shrimp in honey sauce with glazed walnuts, over fried rice.", ingr: ["shrimp", "walnuts", "honey", "rice"] }],
  ["pnd-broccoli-beef", "panda-express", "Broccoli Beef Bowl", "asian", [8.99, 10.49], "regular", { desc: "Marinated beef and broccoli in a ginger soy sauce over steamed rice.", ingr: ["beef", "broccoli", "rice"] }],

  // Domino's
  ["dom-pepperoni-lg", "dominos", "Large Hand Tossed Pepperoni Pizza", "pizza", [14.99, 19.99], "shareable", { desc: "Garlic-seasoned hand-tossed crust with pepperoni and mozzarella.", ingr: ["pepperoni", "mozzarella", "tomato sauce"] }],
  ["dom-extravaganzza", "dominos", "Large ExtravaganZZa Pizza", "pizza", [19.99, 24.99], "shareable", { desc: "Pepperoni, ham, Italian sausage, beef, onions, green peppers, mushrooms and black olives.", ingr: ["pepperoni", "ham", "sausage", "beef", "onion", "peppers", "mushrooms", "olives"] }],
  ["dom-boneless-8", "dominos", "Boneless Chicken (8 pc)", "chicken", [7.99, 9.99], "regular", { desc: "Breaded boneless chicken with a sauce of your choice.", ingr: ["chicken"] }],
  ["dom-cheesy-bread", "dominos", "Stuffed Cheesy Bread", "sides", [6.99, 8.49], "shareable", { desc: "Oven-baked breadsticks stuffed with cheese and brushed with garlic butter.", ingr: ["bread", "cheese", "garlic"] }],

  // Pizza Hut
  ["ph-pan-pepperoni", "pizza-hut", "Large Original Pan Pepperoni Pizza", "pizza", [15.99, 20.49], "shareable", { desc: "Thick, buttery pan crust with pepperoni and mozzarella.", ingr: ["pepperoni", "mozzarella", "tomato sauce"] }],
  ["ph-meat-lovers", "pizza-hut", "Large Meat Lover's Pizza", "pizza", [17.99, 23.49], "shareable", { desc: "Pepperoni, Italian sausage, ham, bacon, seasoned pork and beef.", ingr: ["pepperoni", "sausage", "ham", "bacon", "pork", "beef"] }],
  ["ph-breadsticks", "pizza-hut", "Breadsticks (5)", "sides", [5.99, 7.49], "shareable", { desc: "Breadsticks with marinara for dipping.", ingr: ["bread", "marinara"] }],

  // Little Caesars
  ["lc-classic-pepperoni", "little-caesars", "Classic Large Pepperoni Pizza", "pizza", [6.49, 8.49], "shareable", { desc: "Hot-N-Ready large pepperoni pizza.", ingr: ["pepperoni", "mozzarella", "tomato sauce"] }],
  ["lc-crazy-bread", "little-caesars", "Crazy Bread", "sides", [2.99, 3.99], "shareable", { desc: "Eight breadsticks with garlic butter and Parmesan.", ingr: ["bread", "garlic", "parmesan"] }],
  ["lc-deep-deep", "little-caesars", "Detroit-Style Deep!Deep! Dish Pepperoni", "pizza", [11.49, 13.99], "shareable", { desc: "Rectangular deep-dish pizza baked with cheese to the edges.", ingr: ["pepperoni", "mozzarella", "tomato sauce"] }],

  // Papa Johns
  ["pj-pepperoni-lg", "papa-johns", "Large Pepperoni Pizza", "pizza", [14.99, 19.49], "shareable", { desc: "Original crust with pepperoni and mozzarella, served with garlic sauce.", ingr: ["pepperoni", "mozzarella", "tomato sauce"] }],
  ["pj-the-works", "papa-johns", "Large The Works Pizza", "pizza", [18.99, 23.99], "shareable", { desc: "Pepperoni, ham, Italian sausage, mushrooms, onions, green peppers and black olives.", ingr: ["pepperoni", "ham", "sausage", "mushrooms", "onion", "peppers", "olives"] }],
  ["pj-garlic-knots", "papa-johns", "Garlic Knots", "sides", [6.49, 7.99], "shareable", { desc: "Knotted dough with garlic and Parmesan.", ingr: ["bread", "garlic", "parmesan"] }],

  // Sonic
  ["son-supersonic", "sonic", "SuperSONIC Double Cheeseburger", "burgers", [7.49, 8.99], "large", { desc: "Two beef patties with two slices of cheese, tomato, lettuce, pickles, onion and mayo.", ingr: ["beef", "cheese", "lettuce", "tomato", "pickles", "onion"], combo: [10.49, 12.29] }],
  ["son-coney", "sonic", "Footlong Quarter Pound Coney", "hot dogs", [5.49, 6.49], "regular", { desc: "All-beef footlong hot dog topped with chili and shredded cheddar.", ingr: ["hot dog", "chili", "cheese"] }],
  ["son-tots", "sonic", "Tots (Medium)", "sides", [2.99, 3.79], "snack", { desc: "Crispy tater tots.", ingr: ["potato"] }],
  ["son-cherry-limeade", "sonic", "Cherry Limeade (Medium)", "drinks", [2.49, 3.49], "snack", { desc: "Sprite with real lime and cherry flavor over Sonic ice.", ingr: ["cherry", "lime"] }],

  // Five Guys
  ["fg-cheeseburger", "five-guys", "Cheeseburger", "burgers", [10.49, 12.99], "large", { desc: "Two hand-formed beef patties with American cheese and your choice of free toppings.", ingr: ["beef", "cheese"] }],
  ["fg-little-cheeseburger", "five-guys", "Little Cheeseburger", "burgers", [8.29, 9.99], "regular", { desc: "One hand-formed beef patty with American cheese and free toppings.", ingr: ["beef", "cheese"] }],
  ["fg-bacon-cheeseburger", "five-guys", "Bacon Cheeseburger", "burgers", [11.49, 13.99], "large", { desc: "Two patties, American cheese and applewood-smoked bacon.", ingr: ["beef", "cheese", "bacon"] }],
  ["fg-fries", "five-guys", "Five Guys Style Fries (Regular)", "sides", [5.29, 6.99], "shareable", { desc: "Fresh-cut fries cooked in peanut oil; a regular easily serves two.", ingr: ["potato"] }],

  // Wingstop
  ["ws-classic-10", "wingstop", "10 pc Classic Wings Combo", "chicken", [15.99, 18.99], "large", { desc: "Ten bone-in wings in up to two flavors with fries or veggie sticks, a dip and a drink.", ingr: ["chicken", "wings", "potato"], isCombo: true }],
  ["ws-boneless-10", "wingstop", "10 pc Boneless Wings Combo", "chicken", [12.99, 15.49], "large", { desc: "Ten boneless wings in your choice of flavors with fries, a dip and a drink.", ingr: ["chicken", "wings", "potato"], isCombo: true }],
  ["ws-chicken-sandwich", "wingstop", "Chicken Sandwich", "chicken", [7.49, 8.99], "regular", { desc: "Crispy chicken breast tossed in your choice of flavor on a toasted bun with pickles.", ingr: ["chicken", "pickles"] }],
  ["ws-cajun-corn", "wingstop", "Cajun Fried Corn", "sides", [3.49, 4.49], "snack", { desc: "Fried corn on the cob with Cajun seasoning.", ingr: ["corn", "cajun"] }],

  // Culver's
  ["cul-butterburger", "culvers", "The Original ButterBurger with Cheese", "burgers", [5.49, 6.99], "regular", { desc: "Fresh beef patty on a lightly buttered, toasted bun with cheese.", ingr: ["beef", "cheese", "butter"], combo: [9.49, 11.29] }],
  ["cul-double-deluxe", "culvers", "Double Deluxe ButterBurger", "burgers", [7.49, 8.99], "large", { desc: "Two patties with cheese, lettuce, tomato, red onion, pickles and mayo.", ingr: ["beef", "cheese", "lettuce", "tomato", "onion", "pickles"] }],
  ["cul-cheese-curds", "culvers", "Wisconsin Cheese Curds", "sides", [4.49, 5.79], "regular", { desc: "Lightly breaded and fried Wisconsin cheese curds.", ingr: ["cheese"] }],
  ["cul-cod", "culvers", "North Atlantic Cod Filet Sandwich", "seafood", [6.99, 8.49], "regular", { desc: "Hand-battered cod filet with lettuce and tartar sauce.", ingr: ["cod", "lettuce", "tartar sauce"] }],
  ["cul-concrete", "culvers", "Concrete Mixer (Medium)", "desserts", [4.99, 6.29], "regular", { desc: "Fresh frozen custard blended with your choice of mix-ins.", ingr: ["frozen custard"] }],

  // Jersey Mike's
  ["jm-13", "jersey-mikes", "#13 The Original Italian (Regular)", "sandwiches", [10.49, 12.49], "regular", { desc: "Provolone, ham, prosciuttini, cappacuolo, salami and pepperoni, served Mike's Way.", ingr: ["ham", "salami", "pepperoni", "provolone", "onion", "lettuce", "tomato"] }],
  ["jm-17", "jersey-mikes", "#17 Mike's Famous Philly (Regular)", "sandwiches", [11.49, 13.49], "regular", { desc: "Grilled steak with onions, peppers and white American cheese.", ingr: ["steak", "onion", "peppers", "cheese"] }],
  ["jm-7", "jersey-mikes", "#7 Turkey and Provolone (Regular)", "sandwiches", [9.99, 11.99], "regular", { desc: "Sliced turkey and provolone, served Mike's Way.", ingr: ["turkey", "provolone", "lettuce", "tomato", "onion"] }],

  // Arby's
  ["arb-classic", "arbys", "Classic Roast Beef", "sandwiches", [4.79, 5.99], "regular", { desc: "Thinly sliced roast beef on a toasted sesame seed bun.", ingr: ["roast beef"] }],
  ["arb-beef-cheddar", "arbys", "Classic Beef 'n Cheddar", "sandwiches", [5.49, 6.79], "regular", { desc: "Roast beef with cheddar cheese sauce and red ranch on an onion roll.", ingr: ["roast beef", "cheddar", "onion roll"] }],
  ["arb-brisket", "arbys", "Smokehouse Brisket", "sandwiches", [7.49, 8.99], "regular", { desc: "Smoked brisket with gouda, crispy onions, BBQ sauce and mayo on a toasted bun.", ingr: ["brisket", "gouda", "onion", "bbq"] }],
  ["arb-curly-fries", "arbys", "Curly Fries (Medium)", "sides", [2.99, 3.79], "snack", { desc: "Seasoned curly fries.", ingr: ["potato"] }],

  // Dairy Queen
  ["dq-blizzard-oreo", "dairy-queen", "OREO Cookie Blizzard (Medium)", "desserts", [5.49, 6.49], "regular", { desc: "Vanilla soft serve blended with OREO cookie pieces.", ingr: ["soft serve", "oreo"] }],
  ["dq-strip-basket", "dairy-queen", "4 pc Chicken Strip Basket", "chicken", [8.99, 10.49], "large", { desc: "Four chicken strips with fries, Texas toast and country gravy.", ingr: ["chicken", "tenders", "potato", "texas toast", "gravy"], isCombo: true }],

  // Carl's Jr.
  ["cjr-famous-star", "carls-jr", "Famous Star with Cheese", "burgers", [5.99, 7.29], "regular", { desc: "Charbroiled beef patty with cheese, lettuce, tomato, onions, pickles, special sauce and mayo.", ingr: ["beef", "cheese", "lettuce", "tomato", "onion", "pickles", "charbroiled"], combo: [9.79, 11.49] }],
  ["cjr-western-bacon", "carls-jr", "Western Bacon Cheeseburger", "burgers", [6.99, 8.29], "regular", { desc: "Charbroiled beef patty with bacon, onion rings, American cheese and BBQ sauce.", ingr: ["beef", "bacon", "onion rings", "cheese", "bbq", "charbroiled"], combo: [10.49, 12.29] }],

  // Del Taco
  ["dt-del-taco", "del-taco", "The Del Taco", "tacos", [1.99, 2.79], "snack", { desc: "Seasoned beef, cheddar, lettuce and tomatoes in a crunchy shell — double the cheese and beef of the regular taco.", ingr: ["beef", "cheese", "lettuce", "tomato"] }],
  ["dt-chicken-quesadilla", "del-taco", "Chicken Quesadilla", "mexican", [5.49, 6.79], "regular", { desc: "Grilled chicken and melted cheese in a flour tortilla.", ingr: ["chicken", "cheese", "tortilla"] }],
  ["dt-crinkle-fries", "del-taco", "Crinkle Cut Fries (Medium)", "sides", [2.49, 3.29], "snack", { desc: "Crinkle-cut fries.", ingr: ["potato"] }],

  // Panera
  ["pan-broc-cheddar-bowl", "panera", "Broccoli Cheddar Soup in a Bread Bowl", "bowls", [9.49, 11.49], "large", { desc: "Broccoli cheddar soup served in a sourdough bread bowl.", ingr: ["broccoli", "cheddar", "sourdough"] }],
  ["pan-fuji-apple", "panera", "Fuji Apple Salad with Chicken", "salads", [11.99, 13.99], "regular", { desc: "Chicken, mixed greens, apple chips, pecans, gorgonzola and tomatoes with Fuji apple vinaigrette.", ingr: ["chicken", "apple", "pecans", "gorgonzola", "lettuce"] }],
  ["pan-bacon-turkey-bravo", "panera", "Bacon Turkey Bravo", "sandwiches", [11.49, 13.49], "regular", { desc: "Turkey, bacon, gouda, lettuce, tomato and signature sauce on tomato basil bread.", ingr: ["turkey", "bacon", "gouda", "lettuce", "tomato"] }],

  // Regional: eegee's
  ["eeg-original", "eegees", "Original Lemon eegee (Medium)", "drinks", [2.99, 4.49], "snack", { desc: "Tucson's frozen fruit drink, a local favorite since the 1970s.", ingr: ["lemon", "frozen"] }],
  ["eeg-grinder", "eegees", "Grinder", "sandwiches", [8.49, 10.49], "regular", { desc: "Hot sub with Italian meats, melted cheese and toppings.", ingr: ["salami", "ham", "cheese"] }],
  ["eeg-ranch-fries", "eegees", "Ranch Fries", "sides", [4.49, 5.99], "regular", { desc: "Crinkle-cut fries smothered in ranch dressing.", ingr: ["potato", "ranch"] }],

  // Regional: Lucky Wishbone
  ["lw-steak-fingers", "lucky-wishbone", "Steak Fingers Dinner", "chicken", [10.99, 13.49], "large", { desc: "Breaded, fried steak fingers served with fries and garlic toast.", ingr: ["steak", "potato", "garlic toast"], isCombo: true }],
  ["lw-chicken-dinner", "lucky-wishbone", "Fried Chicken Dinner", "chicken", [10.99, 13.49], "large", { desc: "Bone-in fried chicken with fries and garlic toast.", ingr: ["chicken", "potato", "garlic toast"], isCombo: true }],

  // Regional: Freddy's
  ["fr-double-steakburger", "freddys", "The Original Double Steakburger", "burgers", [6.49, 7.99], "regular", { desc: "Two thin, crispy-edged steakburger patties with cheese, onions, pickles and mustard.", ingr: ["beef", "cheese", "onion", "pickles"], combo: [9.99, 11.79] }],
  ["fr-concrete", "freddys", "Frozen Custard Concrete (Medium)", "desserts", [5.29, 6.49], "regular", { desc: "Vanilla frozen custard blended with your choice of mix-ins.", ingr: ["frozen custard"] }],
];

function toItem([key, chainId, name, category, est, portion, o = {}]: Seed): MenuItem {
  const reported = { source: "catalog" as const, verification: "reported" as const, fetchedAt: CATALOG_DATE, attribution: "Compiled from the chain's public menu" };
  return {
    id: key,
    chainId,
    name,
    description: o.desc,
    category,
    ingredients: o.ingr ?? [],
    price: { low: est[0], high: est[1], currency: "USD", status: "estimate", source: "catalog", channel: "in_store" },
    comboPrice: o.combo ? { low: o.combo[0], high: o.combo[1], currency: "USD", status: "estimate", source: "catalog", channel: "in_store" } : undefined,
    isCombo: o.isCombo ?? false,
    portion: { size: portion },
    nutrition: o.kcal ? { calories: o.kcal, provenance: { ...reported, attribution: "Chain-published nutrition" } } : undefined,
    dietary: [],
    available: true,
    provenance: reported,
  };
}

export const CATALOG_ITEMS: MenuItem[] = SEEDS.map(toItem);
