/**
 * Calculates the price based on distance.
 * - Below 4 km: Fixed Rs 60
 * - 4 km and above: Rs 30 base charge + Rs 10 per km
 */
// export const calculatePrice = (distance: number): number => {
//     if (distance < 2.5) {
//       return 50; 
//     }
//     const baseCharge = 30;
//     const perKmRate = 10;
//     return baseCharge + perKmRate * distance;
//   };

export const calculatePrice = (distance: number): number => {
  if (distance < 2.5) {
    return 50; 
  }
  if (distance >= 42 && distance <= 55) {
    return 330;
  }
  if (distance >= 35 && distance <= 42) {
    return 280;
  }
  if (distance >= 27 && distance <= 35) {
    return 250;
  }
  if (distance >= 22 && distance <= 27) {
    return 230;
  }
  if (distance >= 16 && distance <= 22) {
    return 200;
  }
  

  const baseCharge = 30;
  const perKmRate = 10;
  return baseCharge + perKmRate * distance;
};
