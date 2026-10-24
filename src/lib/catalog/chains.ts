import type { Chain } from "../types";

/**
 * Chains CRAVE recognizes, national first, then regional (per the rollout plan).
 *
 * `wikidata` is only filled in where we're confident; matching also uses
 * normalized names + aliases, and the refresh job proposes missing IDs it sees
 * in OSM `brand:wikidata` tags for an admin to confirm.
 * `directOrderUrl` is the chain's own site — never a guessed deep link.
 */
export const CHAINS: Chain[] = [
  { id: "mcdonalds", slug: "mcdonalds", name: "McDonald's", tier: "national", priority: 1, wikidata: "Q38076", aliases: ["mcdonalds", "mc donalds"], website: "https://www.mcdonalds.com", directOrderUrl: "https://www.mcdonalds.com/us/en-us/mobile-order-and-pay.html", categories: ["burgers", "chicken", "breakfast"], priceLevel: 1 },
  { id: "chick-fil-a", slug: "chick-fil-a", name: "Chick-fil-A", tier: "national", priority: 2, wikidata: "Q491516", aliases: ["chick fil a", "chickfila"], website: "https://www.chick-fil-a.com", directOrderUrl: "https://www.chick-fil-a.com/order", categories: ["chicken", "sandwiches"], priceLevel: 1 },
  { id: "taco-bell", slug: "taco-bell", name: "Taco Bell", tier: "national", priority: 3, wikidata: "Q752941", aliases: ["tacobell"], website: "https://www.tacobell.com", directOrderUrl: "https://www.tacobell.com", categories: ["tacos", "mexican"], priceLevel: 1 },
  { id: "wendys", slug: "wendys", name: "Wendy's", tier: "national", priority: 4, wikidata: "Q550258", aliases: ["wendys"], website: "https://www.wendys.com", directOrderUrl: "https://order.wendys.com", categories: ["burgers", "chicken"], priceLevel: 1 },
  { id: "burger-king", slug: "burger-king", name: "Burger King", tier: "national", priority: 5, wikidata: "Q177054", aliases: ["burgerking", "bk"], website: "https://www.bk.com", directOrderUrl: "https://www.bk.com", categories: ["burgers"], priceLevel: 1 },
  { id: "popeyes", slug: "popeyes", name: "Popeyes", tier: "national", priority: 6, wikidata: "Q1330910", aliases: ["popeyes louisiana kitchen", "popeyes chicken"], website: "https://www.popeyes.com", directOrderUrl: "https://www.popeyes.com", categories: ["chicken"], priceLevel: 1 },
  { id: "raising-canes", slug: "raising-canes", name: "Raising Cane's", tier: "national", priority: 7, wikidata: "Q7285144", aliases: ["raising canes", "raising cane's chicken fingers", "canes"], website: "https://www.raisingcanes.com", directOrderUrl: "https://www.raisingcanes.com", categories: ["chicken"], priceLevel: 1 },
  { id: "in-n-out", slug: "in-n-out", name: "In-N-Out Burger", tier: "national", priority: 8, wikidata: "Q1205312", aliases: ["in n out", "in-n-out", "innout"], website: "https://www.in-n-out.com", categories: ["burgers"], priceLevel: 1 },
  { id: "whataburger", slug: "whataburger", name: "Whataburger", tier: "national", priority: 9, wikidata: "Q376627", aliases: [], website: "https://whataburger.com", directOrderUrl: "https://whataburger.com", categories: ["burgers", "breakfast"], priceLevel: 1 },
  { id: "chipotle", slug: "chipotle", name: "Chipotle Mexican Grill", tier: "national", priority: 10, wikidata: "Q465751", aliases: ["chipotle"], website: "https://www.chipotle.com", directOrderUrl: "https://www.chipotle.com/order", categories: ["mexican", "bowls"], priceLevel: 2 },
  { id: "subway", slug: "subway", name: "Subway", tier: "national", priority: 11, wikidata: "Q244457", aliases: [], website: "https://www.subway.com", directOrderUrl: "https://www.subway.com", categories: ["sandwiches"], priceLevel: 1 },
  { id: "jack-in-the-box", slug: "jack-in-the-box", name: "Jack in the Box", tier: "national", priority: 12, wikidata: "Q1538507", aliases: ["jack in the box"], website: "https://www.jackinthebox.com", directOrderUrl: "https://www.jackinthebox.com", categories: ["burgers", "tacos"], priceLevel: 1 },
  { id: "kfc", slug: "kfc", name: "KFC", tier: "national", priority: 13, wikidata: "Q524757", aliases: ["kentucky fried chicken"], website: "https://www.kfc.com", directOrderUrl: "https://www.kfc.com", categories: ["chicken"], priceLevel: 1 },
  { id: "panda-express", slug: "panda-express", name: "Panda Express", tier: "national", priority: 14, wikidata: "Q1358690", aliases: [], website: "https://www.pandaexpress.com", directOrderUrl: "https://www.pandaexpress.com", categories: ["asian"], priceLevel: 1 },
  { id: "dominos", slug: "dominos", name: "Domino's", tier: "national", priority: 15, wikidata: "Q839466", aliases: ["dominos pizza", "domino's pizza"], website: "https://www.dominos.com", directOrderUrl: "https://www.dominos.com", categories: ["pizza"], priceLevel: 1 },
  { id: "pizza-hut", slug: "pizza-hut", name: "Pizza Hut", tier: "national", priority: 16, wikidata: "Q191615", aliases: [], website: "https://www.pizzahut.com", directOrderUrl: "https://www.pizzahut.com", categories: ["pizza"], priceLevel: 1 },
  { id: "little-caesars", slug: "little-caesars", name: "Little Caesars", tier: "national", priority: 17, wikidata: "Q1393809", aliases: ["little caesars pizza"], website: "https://littlecaesars.com", directOrderUrl: "https://littlecaesars.com", categories: ["pizza"], priceLevel: 1 },
  { id: "papa-johns", slug: "papa-johns", name: "Papa Johns", tier: "national", priority: 18, wikidata: "Q2759586", aliases: ["papa john's", "papa johns pizza"], website: "https://www.papajohns.com", directOrderUrl: "https://www.papajohns.com", categories: ["pizza"], priceLevel: 1 },
  { id: "sonic", slug: "sonic", name: "Sonic Drive-In", tier: "national", priority: 19, wikidata: "Q7561808", aliases: ["sonic"], website: "https://www.sonicdrivein.com", directOrderUrl: "https://www.sonicdrivein.com", categories: ["burgers", "hot dogs", "drinks"], priceLevel: 1 },
  { id: "five-guys", slug: "five-guys", name: "Five Guys", tier: "national", priority: 20, wikidata: "Q1131810", aliases: ["five guys burgers and fries"], website: "https://www.fiveguys.com", directOrderUrl: "https://order.fiveguys.com", categories: ["burgers"], priceLevel: 2 },
  { id: "wingstop", slug: "wingstop", name: "Wingstop", tier: "national", priority: 21, wikidata: "Q8025339", aliases: [], website: "https://www.wingstop.com", directOrderUrl: "https://www.wingstop.com", categories: ["chicken"], priceLevel: 2 },
  { id: "culvers", slug: "culvers", name: "Culver's", tier: "national", priority: 22, wikidata: "Q1143589", aliases: ["culvers"], website: "https://www.culvers.com", directOrderUrl: "https://www.culvers.com", categories: ["burgers", "desserts"], priceLevel: 1 },
  { id: "jersey-mikes", slug: "jersey-mikes", name: "Jersey Mike's Subs", tier: "national", priority: 23, wikidata: "Q6184897", aliases: ["jersey mikes", "jersey mike's"], website: "https://www.jerseymikes.com", directOrderUrl: "https://www.jerseymikes.com", categories: ["sandwiches"], priceLevel: 2 },
  { id: "arbys", slug: "arbys", name: "Arby's", tier: "national", priority: 24, wikidata: "Q630866", aliases: ["arbys"], website: "https://www.arbys.com", directOrderUrl: "https://www.arbys.com", categories: ["sandwiches"], priceLevel: 1 },
  { id: "dairy-queen", slug: "dairy-queen", name: "Dairy Queen", tier: "national", priority: 25, wikidata: "Q1141226", aliases: ["dq", "dq grill & chill"], website: "https://www.dairyqueen.com", directOrderUrl: "https://www.dairyqueen.com", categories: ["burgers", "desserts"], priceLevel: 1 },
  { id: "carls-jr", slug: "carls-jr", name: "Carl's Jr.", tier: "national", priority: 26, wikidata: "Q1043486", aliases: ["carls jr", "carl's jr"], website: "https://www.carlsjr.com", directOrderUrl: "https://www.carlsjr.com", categories: ["burgers"], priceLevel: 1 },
  { id: "del-taco", slug: "del-taco", name: "Del Taco", tier: "national", priority: 27, wikidata: "Q1183818", aliases: ["deltaco"], website: "https://www.deltaco.com", directOrderUrl: "https://www.deltaco.com", categories: ["tacos", "mexican"], priceLevel: 1 },
  { id: "panera", slug: "panera", name: "Panera Bread", tier: "national", priority: 28, wikidata: "Q7130852", aliases: ["panera"], website: "https://www.panerabread.com", directOrderUrl: "https://www.panerabread.com", categories: ["sandwiches", "salads"], priceLevel: 2 },
  // Regional (Southwest / Tucson)
  { id: "eegees", slug: "eegees", name: "eegee's", tier: "regional", priority: 40, aliases: ["eegees", "eegee's"], website: "https://eegees.com", directOrderUrl: "https://eegees.com", categories: ["sandwiches", "drinks"], priceLevel: 1 },
  { id: "lucky-wishbone", slug: "lucky-wishbone", name: "Lucky Wishbone", tier: "regional", priority: 41, aliases: ["the lucky wishbone"], website: "https://luckywishbone.com", categories: ["chicken"], priceLevel: 1 },
  { id: "freddys", slug: "freddys", name: "Freddy's Frozen Custard & Steakburgers", tier: "regional", priority: 42, aliases: ["freddys", "freddy's"], website: "https://www.freddys.com", directOrderUrl: "https://www.freddys.com", categories: ["burgers", "desserts"], priceLevel: 1 },
];

export const CHAIN_BY_ID = new Map(CHAINS.map((c) => [c.id, c]));
