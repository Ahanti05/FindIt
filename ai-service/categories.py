"""
FindIt item categories and the text prompts CLIP uses to recognise them.

Keep CATEGORIES in sync with backend/src/config/constants.js.
"""

CATEGORIES = [
    "ID Card", "Wallet", "Keys", "Phone", "Laptop", "Bag/Backpack",
    "Watch", "Earphones/AirPods", "Charger/Cable", "Water Bottle",
    "Umbrella", "Glasses", "Clothing", "Books/Notes", "Jewelry", "Other",
]

# Several phrasings per category; their text embeddings are averaged.
# "Other" has no prompts – it is the fallback when nothing is confident.
CATEGORY_PROMPTS = {
    "ID Card": [
        "a photo of a student ID card",
        "a photo of an identity card with a photo and a barcode",
        "a photo of a plastic badge card on a lanyard",
    ],
    "Wallet": [
        "a photo of a wallet",
        "a photo of a leather bifold wallet",
        "a photo of a purse",
    ],
    "Keys": [
        "a photo of keys",
        "a photo of a bunch of keys on a keyring",
        "a photo of a car key with a keychain",
    ],
    "Phone": [
        "a photo of a smartphone",
        "a photo of a mobile phone",
    ],
    "Laptop": [
        "a photo of a laptop computer",
        "a photo of a notebook computer",
    ],
    "Bag/Backpack": [
        "a photo of a backpack",
        "a photo of a bag",
        "a photo of a handbag",
    ],
    "Watch": [
        "a photo of a wristwatch",
        "a photo of a smartwatch",
    ],
    "Earphones/AirPods": [
        "a photo of headphones",
        "a photo of wireless earbuds",
        "a photo of earphones",
    ],
    "Charger/Cable": [
        "a photo of a phone charger",
        "a photo of a USB charging cable",
        "a photo of a laptop power adapter",
    ],
    "Water Bottle": [
        "a photo of a water bottle",
        "a photo of a reusable metal bottle",
    ],
    "Umbrella": [
        "a photo of an umbrella",
        "a photo of a folded umbrella",
    ],
    "Glasses": [
        "a photo of eyeglasses",
        "a photo of sunglasses",
    ],
    "Clothing": [
        "a photo of a jacket",
        "a photo of a sweater or hoodie",
        "a photo of a scarf or cap",
    ],
    "Books/Notes": [
        "a photo of a book",
        "a photo of a notebook",
        "a photo of a stack of notes",
    ],
    "Jewelry": [
        "a photo of jewelry",
        "a photo of a ring",
        "a photo of a necklace or bracelet",
    ],
}

# COCO classes that YOLOv8 can localise and that correspond to an item we
# care about. Only these are used to crop the image before embedding; a
# detected "person" or "dining table" would be a bad crop.
YOLO_TO_CATEGORY = {
    "backpack": "Bag/Backpack",
    "handbag": "Bag/Backpack",
    "suitcase": "Bag/Backpack",
    "cell phone": "Phone",
    "laptop": "Laptop",
    "book": "Books/Notes",
    "umbrella": "Umbrella",
    "bottle": "Water Bottle",
    "clock": "Watch",
    "tie": "Clothing",
}
