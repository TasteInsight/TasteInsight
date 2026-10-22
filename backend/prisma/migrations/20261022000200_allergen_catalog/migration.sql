CREATE EXTENSION IF NOT EXISTS citext;

ALTER TABLE "users" ALTER COLUMN "allergens" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "allergens" TYPE CITEXT[] USING "allergens"::CITEXT[];
ALTER TABLE "users" ALTER COLUMN "allergens" SET DEFAULT ARRAY[]::CITEXT[];
ALTER TABLE "dishes" ALTER COLUMN "allergens" TYPE CITEXT[] USING "allergens"::CITEXT[];
ALTER TABLE "dish_uploads" ALTER COLUMN "allergens" TYPE CITEXT[] USING "allergens"::CITEXT[];

CREATE TABLE "allergens" (
  "value" TEXT NOT NULL PRIMARY KEY,
  "nameZh" TEXT NOT NULL,
  "nameEn" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "allergen_aliases" (
  "name" CITEXT NOT NULL PRIMARY KEY,
  "allergenValue" TEXT NOT NULL REFERENCES "allergens"("value") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "allergen_aliases_allergenValue_idx" ON "allergen_aliases"("allergenValue");

INSERT INTO "allergens" ("value", "nameZh", "nameEn") VALUES
  ('花生','花生','Peanuts'),
  ('牛奶','牛奶','Milk'),
  ('鸡蛋','鸡蛋','Eggs'),
  ('海鲜','海鲜','Seafood'),
  ('大豆','大豆','Soy'),
  ('小麦','小麦','Wheat'),
  ('坚果','坚果','Tree nuts'),
  ('芝麻','芝麻','Sesame'),
  ('芒果','芒果','Mango'),
  ('菠萝','菠萝','Pineapple'),
  ('猕猴桃','猕猴桃','Kiwi'),
  ('桃子','桃子','Peach'),
  ('蚕豆','蚕豆','Broad beans'),
  ('虾','虾','Shrimp'),
  ('蟹','蟹','Crab');

INSERT INTO "allergen_aliases" ("name", "allergenValue") VALUES
  ('花生','花生'),
  ('Peanuts','花生'),
  ('Peanut','花生'),
  ('牛奶','牛奶'),
  ('Milk','牛奶'),
  ('鸡蛋','鸡蛋'),
  ('Eggs','鸡蛋'),
  ('Egg','鸡蛋'),
  ('海鲜','海鲜'),
  ('Seafood','海鲜'),
  ('大豆','大豆'),
  ('Soy','大豆'),
  ('Soybean','大豆'),
  ('Soybeans','大豆'),
  ('小麦','小麦'),
  ('Wheat','小麦'),
  ('坚果','坚果'),
  ('Tree nuts','坚果'),
  ('Tree nut','坚果'),
  ('芝麻','芝麻'),
  ('Sesame','芝麻'),
  ('芒果','芒果'),
  ('Mango','芒果'),
  ('Mangoes','芒果'),
  ('菠萝','菠萝'),
  ('Pineapple','菠萝'),
  ('Pineapples','菠萝'),
  ('猕猴桃','猕猴桃'),
  ('Kiwi','猕猴桃'),
  ('Kiwifruit','猕猴桃'),
  ('桃子','桃子'),
  ('Peach','桃子'),
  ('Peaches','桃子'),
  ('蚕豆','蚕豆'),
  ('Broad beans','蚕豆'),
  ('Broad bean','蚕豆'),
  ('Fava beans','蚕豆'),
  ('Fava bean','蚕豆'),
  ('虾','虾'),
  ('Shrimp','虾'),
  ('蟹','蟹'),
  ('Crab','蟹'),
  ('Crabs','蟹');
