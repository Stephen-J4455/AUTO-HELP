type Destination = { tab: 'search' | 'vehicle' | 'cart' | 'account' } | { screen: 'CategoriesList' | 'Orders' | 'Notifications' };

type Mission = {
  title: string;
  task: string;
  prompt: string;
  destination: Destination;
};

export const MISSIONS: readonly Mission[] = [
  { title: 'Get around AutoHelp', task: 'Open Account and find where you would manage your profile or view orders.', prompt: 'What was easy or hard to find?', destination: { tab: 'account' } },
  { title: 'Find your vehicle', task: 'Look up a car by make, model and year.', prompt: 'Which car did you try and did you find it?', destination: { tab: 'vehicle' } },
  { title: 'Find a compatible part', task: 'Open a vehicle and browse the parts listed for it.', prompt: 'Which part did you find and what fitment details did you see?', destination: { tab: 'vehicle' } },
  { title: 'Search your way', task: 'Search for a part using the words you would use with a mechanic.', prompt: 'What did you type and what came back?', destination: { tab: 'search' } },
  { title: 'Search by SKU or brand', task: 'Try a known SKU or brand name, then open a matching result.', prompt: 'Which SKU or brand did you try and did it work?', destination: { tab: 'search' } },
  { title: 'Inspect a listing', task: 'Open a part and look through its photos, price and vehicle compatibility.', prompt: 'What would you still need to know before buying?', destination: { tab: 'search' } },
  { title: 'Check your cart', task: 'Add a part, change its quantity and check that the total updates.', prompt: 'What happened to the total when you changed the quantity?', destination: { tab: 'cart' } },
  { title: 'Pick up where you left off', task: 'Close and reopen AutoHelp, then return to your cart.', prompt: 'Were your items still there and easy to find?', destination: { tab: 'cart' } },
  { title: 'Preview delivery', task: 'Continue from the cart to checkout and review the delivery options. Stop before submitting an order.', prompt: 'Which delivery options could you see and what was unclear?', destination: { tab: 'cart' } },
  { title: 'Review payment options', task: 'Look at the available payment options in checkout. Leave checkout without paying or placing an order.', prompt: 'Which payment options appeared and were they clear?', destination: { tab: 'cart' } },
  { title: 'Find order status', task: 'Open My Orders. If you have an order, check its status. Otherwise, check what the empty page tells you.', prompt: 'What status or message did you see?', destination: { screen: 'Orders' } },
  { title: 'Try a hard-to-find part', task: 'Search for a part you actually need, or a part you expect to be missing.', prompt: 'What did you search for and what did you do next?', destination: { tab: 'search' } },
  { title: 'Try a problem again', task: 'Repeat one task that was difficult earlier. If everything worked, check whether the notification inbox is easy to use.', prompt: 'What did you retest and what happened?', destination: { screen: 'Notifications' } },
  { title: 'Shop without a guide', task: 'Start from a vehicle or category and find a part you could buy. Stop before payment.', prompt: 'What is the biggest thing that would stop you using AutoHelp again?', destination: { screen: 'CategoriesList' } },
];

