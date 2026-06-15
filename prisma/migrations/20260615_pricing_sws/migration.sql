-- Add Social Welfare Surcharge (% of customs duty) to the pricing rule.
ALTER TABLE "PricingRule" ADD COLUMN "swsPct" DECIMAL(5,2) NOT NULL DEFAULT 0;
