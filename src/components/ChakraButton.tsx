import { Button, LinkBox, LinkOverlay } from "@chakra-ui/react";
import Image from "next/image";
import Link from "next/link";

type ButtonProps = {
  href: string;
  color: string; //ex: lowercase 'blue'
  label: string;
  width?: string;
  minW?: string;
  iconSrc?: string;
};

export default function ChakraButton({ href, color, label, width, minW, iconSrc }: ButtonProps) {
  return (
    <LinkBox>
      <LinkOverlay as={Link} href={href}>
        <Button
          w="full"
          size="lg"
          width={width}
          minW={minW}
          py={8}
          position="relative"
          overflow="hidden" // keeps the blue bottom highlight within the button
          borderRadius="18px"
          bg={`${color}.500`}
          color="white"
          fontSize="lg"
          fontWeight="900"
          letterSpacing="0.05em"
          _hover={{ bg: `${color}.600` }}
          boxShadow="0 14px 28px rgba(15, 23, 42, 0.16)"
          _after={{
            content: '""',
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "8px",
            bg: "rgba(0,0,0,0.12)",
            pointerEvents: "none",
          }}
        >
          {iconSrc && (
            <Image
              src={iconSrc}
              alt={`${label} icon`}
              width={22}
              height={22}
              style={{ objectFit: "contain", display: "block" }}
            />
          )}
          {label}
        </Button>
      </LinkOverlay>
    </LinkBox>
  );
}
