import { Badge, Box, Flex, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { ReactNode } from "react";
import { FiBarChart2, FiClock, FiMoreHorizontal } from "react-icons/fi";

export type TrendDirection = "up" | "down" | "flat" | "na";

type MetricTrend = {
  label: string;
  direction: TrendDirection;
};

type AdminMetricsCardProps = {
  title: string;
  icon: ReactNode;
  accentColor: string;
  playersValue: string;
  playersTrend: MetricTrend;
  totalPlayTimeValue: string;
  totalPlayTimeTrend: MetricTrend;
  averageTimeValue: string;
};

function getTrendColor(direction: TrendDirection): string {
  if (direction === "up") return "green.500";
  if (direction === "down") return "orange.400";
  return "gray.500";
}

function PrimaryMetric({ label, value, trend }: { label: string; value: string; trend: MetricTrend }) {
  return (
    <Box>
      <Text fontSize="xs" fontWeight="700" letterSpacing="0.08em" color="gray.500" textTransform="uppercase">
        {label}
      </Text>
      <Text mt={1} fontSize={{ base: "2xl", md: "3xl" }} lineHeight="1.1" fontWeight="800" color="gray.900">
        {value}
      </Text>
      <Text mt={1} fontSize="xs" fontWeight="700" color={getTrendColor(trend.direction)}>
        {trend.label}
      </Text>
    </Box>
  );
}

export function AdminMetricsCard({
  title,
  icon,
  accentColor,
  playersValue,
  playersTrend,
  totalPlayTimeValue,
  totalPlayTimeTrend,
  averageTimeValue,
}: AdminMetricsCardProps) {
  return (
    <Box
      bg="white"
      borderRadius="20px"
      boxShadow="0 14px 32px rgba(15, 23, 42, 0.10)"
      border="1px solid"
      borderColor="gray.100"
      position="relative"
      overflow="hidden"
    >
      <Box h="5px" w="full" bg={accentColor} />

      <VStack align="stretch" gap={5} p={{ base: 5, md: 6 }}>
        <Flex align="start" justify="space-between" gap={3}>
          <HStack gap={3} align="start">
            <Flex
              h="48px"
              w="48px"
              borderRadius="14px"
              border="1px solid"
              borderColor="gray.200"
              bg="gray.50"
              align="center"
              justify="center"
            >
              {icon}
            </Flex>

            <Box>
              <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="800" color="gray.900" lineHeight="1.2">
                {title}
              </Text>
              <Badge mt={1.5} borderRadius="999px" px={2} py={0.5} bg="gray.100" color="gray.600" fontSize="0.68rem">
                LIVE GAME
              </Badge>
            </Box>
          </HStack>

          <Box
            as="button"
            aria-label={`${title} options`}
            p={1}
            color="gray.400"
            borderRadius="8px"
            _hover={{ bg: "gray.100", color: "gray.600" }}
          >
            <Icon as={FiMoreHorizontal} boxSize={4.5} />
          </Box>
        </Flex>

        <Flex gap={6} justify="space-between" wrap="wrap">
          <PrimaryMetric label="Players" value={playersValue} trend={playersTrend} />
          <PrimaryMetric label="Total Play Time" value={totalPlayTimeValue} trend={totalPlayTimeTrend} />
        </Flex>

        <Box h="1px" bg="gray.200" />

        <Flex align="end" justify="space-between" gap={3}>
          <Box>
            <Text fontSize="xs" fontWeight="700" letterSpacing="0.08em" color="gray.500" textTransform="uppercase">
              Avg. Time Per Player
            </Text>
            <HStack gap={2} mt={1}>
              <Icon as={FiClock} color="gray.400" boxSize={4} />
              <Text fontSize="lg" fontWeight="800" color="gray.800">
                {averageTimeValue}
              </Text>
            </HStack>
          </Box>

          <Icon as={FiBarChart2} boxSize={6} color="gray.300" />
        </Flex>
      </VStack>
    </Box>
  );
}
