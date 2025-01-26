export interface StoreItem {
    id: string;
    name: string;
    type: 'background' | 'cardBack'; // Típus: háttér vagy kártya hátlap
    price: number; // Ár
    image: string; // Az elem képe
  }