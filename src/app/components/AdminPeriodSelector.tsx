import { Button, HStack } from "@chakra-ui/react";

export type AdminPeriod = "7d" | "30d" | "all";

const PERIOD_OPTIONS: Array<{ value: AdminPeriod; label: string }> = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Monthly" },
  { value: "all", label: "All Time" },
];

type AdminPeriodSelectorProps = {
  value: AdminPeriod;
  onChange: (value: AdminPeriod) => void;
};

export function AdminPeriodSelector({ value, onChange }: AdminPeriodSelectorProps) {
  return (
    <HStack
      w={{ base: "full", md: "fit-content" }}
      justify={{ base: "space-between", md: "flex-start" }}
      p={1.5}
      borderRadius="14px"
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="0 10px 28px rgba(15, 23, 42, 0.08)"
      gap={1}
      flexWrap={{ base: "wrap", md: "nowrap" }}
    >
      {PERIOD_OPTIONS.map((option) => {
        const isSelected = option.value === value;
        return (
          <Button
            key={option.value}
            size="sm"
            minW={{ base: "unset", md: "116px" }}
            borderRadius="12px"
            onClick={() => onChange(option.value)}
            bg={isSelected ? "blue.600" : "transparent"}
            color={isSelected ? "white" : "gray.700"}
            fontWeight="700"
            border="1px solid"
            borderColor={isSelected ? "blue.600" : "transparent"}
            _hover={{ bg: isSelected ? "blue.700" : "gray.100" }}
          >
            {option.label}
          </Button>
        );
      })}
    </HStack>
  );
}
