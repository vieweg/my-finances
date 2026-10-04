import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1700000000000 implements MigrationInterface {
    name = 'InitialSchema1700000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`users\` (\`id\` varchar(36) NOT NULL, \`name\` varchar(255) NOT NULL, \`username\` varchar(255) NOT NULL, \`email\` varchar(255) NOT NULL, \`password\` varchar(255) NOT NULL, \`resetToken\` varchar(255) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, UNIQUE INDEX \`IDX_fe0bb3f6520ee0469504521e71\` (\`username\`), UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`), UNIQUE INDEX \`IDX_a4bfb41ec19ba07b20d6e1ed02\` (\`resetToken\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`sessions\` (\`id\` varchar(36) NOT NULL, \`token\` text NOT NULL, \`refreshToken\` text NOT NULL, \`expiresAt\` timestamp NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`userId\` varchar(36) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`wallets\` (\`id\` varchar(36) NOT NULL, \`name\` varchar(100) NOT NULL, \`currency\` char(3) NOT NULL, \`position\` int NOT NULL DEFAULT '0', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`userId\` varchar(36) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`tags\` (\`id\` varchar(36) NOT NULL, \`name\` text NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`userId\` varchar(36) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`contacts\` (\`id\` varchar(36) NOT NULL, \`name\` varchar(255) NOT NULL, \`document\` varchar(255) NULL, \`email\` varchar(255) NULL, \`phone\` varchar(255) NULL, \`notes\` text NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`userId\` varchar(36) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`contracts\` (\`id\` varchar(36) NOT NULL, \`name\` varchar(150) NOT NULL, \`type\` varchar(10) NOT NULL COMMENT 'payable | receivable', \`amount\` decimal(10,2) NOT NULL, \`currency\` char(3) NOT NULL, \`description\` text NOT NULL, \`instalments\` int UNSIGNED NOT NULL, \`instalmentsDone\` int UNSIGNED NOT NULL DEFAULT '0', \`cycleMonths\` tinyint UNSIGNED NOT NULL, \`firstDueDate\` datetime NOT NULL, \`nextDueDate\` datetime NOT NULL, \`status\` enum ('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`userId\` varchar(36) NULL, \`contactId\` varchar(36) NULL, \`walletId\` varchar(36) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`invoices\` (\`id\` varchar(36) NOT NULL, \`type\` varchar(10) NOT NULL COMMENT 'payable | receivable', \`status\` varchar(10) NOT NULL COMMENT 'pending | partial | paid | cancelled' DEFAULT 'pending', \`amount\` decimal(10,2) NOT NULL, \`currency\` char(3) NOT NULL, \`issueDate\` datetime NOT NULL, \`dueDate\` datetime NOT NULL, \`description\` text NULL, \`history\` json NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`userId\` varchar(36) NULL, \`contactId\` varchar(36) NULL, \`walletId\` varchar(36) NULL, \`contractId\` varchar(36) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`transactions\` (\`id\` varchar(36) NOT NULL, \`originalId\` varchar(255) NULL, \`version\` int NOT NULL DEFAULT '1', \`total\` decimal(10,2) NOT NULL, \`currency\` char(3) NOT NULL, \`date\` datetime NOT NULL, \`description\` text NOT NULL, \`type\` varchar(10) NOT NULL COMMENT 'income | outcome', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`userId\` varchar(36) NULL, \`walletId\` varchar(36) NULL, \`invoiceId\` varchar(36) NULL, INDEX \`IDX_3d454294cc51b7a716ab26464b\` (\`userId\`, \`currency\`, \`deletedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`wallet_snapshots\` (\`id\` varchar(36) NOT NULL, \`amount\` decimal(14,2) NOT NULL, \`delta\` decimal(14,2) NOT NULL, \`source\` varchar(20) NOT NULL COMMENT 'manual | transaction', \`transactionId\` varchar(255) NULL, \`recordedAt\` datetime NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`walletId\` varchar(36) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`contract_tags\` (\`contract_id\` varchar(36) NOT NULL, \`tag_id\` varchar(36) NOT NULL, INDEX \`IDX_841a957ac3be3bfa78b4a1ec90\` (\`contract_id\`), INDEX \`IDX_e841a065d532c259d24829a50b\` (\`tag_id\`), PRIMARY KEY (\`contract_id\`, \`tag_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`invoice_tags\` (\`invoice_id\` varchar(36) NOT NULL, \`tag_id\` varchar(36) NOT NULL, INDEX \`IDX_f053a74b5048bd7545f64084a1\` (\`invoice_id\`), INDEX \`IDX_627248d810e0d04f78631a320c\` (\`tag_id\`), PRIMARY KEY (\`invoice_id\`, \`tag_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`transactions_tags\` (\`transaction_id\` varchar(36) NOT NULL, \`tag_id\` varchar(36) NOT NULL, INDEX \`IDX_b43f29533801ade11b6fb79bc8\` (\`transaction_id\`), INDEX \`IDX_baa8a5aceb11d30d2e8051321f\` (\`tag_id\`), PRIMARY KEY (\`transaction_id\`, \`tag_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`sessions\` ADD CONSTRAINT \`FK_57de40bc620f456c7311aa3a1e6\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`wallets\` ADD CONSTRAINT \`FK_2ecdb33f23e9a6fc392025c0b97\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`tags\` ADD CONSTRAINT \`FK_92e67dc508c705dd66c94615576\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`contacts\` ADD CONSTRAINT \`FK_30ef77942fc8c05fcb829dcc61d\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`contracts\` ADD CONSTRAINT \`FK_4f178b72ba6f1e74f6643d86c11\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`contracts\` ADD CONSTRAINT \`FK_daba0382e0de7a0293174d8f45b\` FOREIGN KEY (\`contactId\`) REFERENCES \`contacts\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`contracts\` ADD CONSTRAINT \`FK_ae7391ff0623c3cfb9c98602726\` FOREIGN KEY (\`walletId\`) REFERENCES \`wallets\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`invoices\` ADD CONSTRAINT \`FK_fcbe490dc37a1abf68f19c5ccb9\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`invoices\` ADD CONSTRAINT \`FK_152988a3fbcfc5428f772409da8\` FOREIGN KEY (\`contactId\`) REFERENCES \`contacts\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`invoices\` ADD CONSTRAINT \`FK_bdd2641a063181d0c3fde79a61f\` FOREIGN KEY (\`walletId\`) REFERENCES \`wallets\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`invoices\` ADD CONSTRAINT \`FK_42d017ec6c4a79ea33cbe9dbfba\` FOREIGN KEY (\`contractId\`) REFERENCES \`contracts\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`transactions\` ADD CONSTRAINT \`FK_6bb58f2b6e30cb51a6504599f41\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`transactions\` ADD CONSTRAINT \`FK_a88f466d39796d3081cf96e1b66\` FOREIGN KEY (\`walletId\`) REFERENCES \`wallets\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`transactions\` ADD CONSTRAINT \`FK_9bde8424ba459604061c4cb01f2\` FOREIGN KEY (\`invoiceId\`) REFERENCES \`invoices\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`wallet_snapshots\` ADD CONSTRAINT \`FK_5cca76a6cfab43c80884fad39a9\` FOREIGN KEY (\`walletId\`) REFERENCES \`wallets\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`contract_tags\` ADD CONSTRAINT \`FK_841a957ac3be3bfa78b4a1ec90c\` FOREIGN KEY (\`contract_id\`) REFERENCES \`contracts\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`contract_tags\` ADD CONSTRAINT \`FK_e841a065d532c259d24829a50b8\` FOREIGN KEY (\`tag_id\`) REFERENCES \`tags\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`invoice_tags\` ADD CONSTRAINT \`FK_f053a74b5048bd7545f64084a14\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoices\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`invoice_tags\` ADD CONSTRAINT \`FK_627248d810e0d04f78631a320ce\` FOREIGN KEY (\`tag_id\`) REFERENCES \`tags\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`transactions_tags\` ADD CONSTRAINT \`FK_b43f29533801ade11b6fb79bc8f\` FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`transactions_tags\` ADD CONSTRAINT \`FK_baa8a5aceb11d30d2e8051321f3\` FOREIGN KEY (\`tag_id\`) REFERENCES \`tags\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`transactions_tags\` DROP FOREIGN KEY \`FK_baa8a5aceb11d30d2e8051321f3\``);
        await queryRunner.query(`ALTER TABLE \`transactions_tags\` DROP FOREIGN KEY \`FK_b43f29533801ade11b6fb79bc8f\``);
        await queryRunner.query(`ALTER TABLE \`invoice_tags\` DROP FOREIGN KEY \`FK_627248d810e0d04f78631a320ce\``);
        await queryRunner.query(`ALTER TABLE \`invoice_tags\` DROP FOREIGN KEY \`FK_f053a74b5048bd7545f64084a14\``);
        await queryRunner.query(`ALTER TABLE \`contract_tags\` DROP FOREIGN KEY \`FK_e841a065d532c259d24829a50b8\``);
        await queryRunner.query(`ALTER TABLE \`contract_tags\` DROP FOREIGN KEY \`FK_841a957ac3be3bfa78b4a1ec90c\``);
        await queryRunner.query(`ALTER TABLE \`wallet_snapshots\` DROP FOREIGN KEY \`FK_5cca76a6cfab43c80884fad39a9\``);
        await queryRunner.query(`ALTER TABLE \`transactions\` DROP FOREIGN KEY \`FK_9bde8424ba459604061c4cb01f2\``);
        await queryRunner.query(`ALTER TABLE \`transactions\` DROP FOREIGN KEY \`FK_a88f466d39796d3081cf96e1b66\``);
        await queryRunner.query(`ALTER TABLE \`transactions\` DROP FOREIGN KEY \`FK_6bb58f2b6e30cb51a6504599f41\``);
        await queryRunner.query(`ALTER TABLE \`invoices\` DROP FOREIGN KEY \`FK_42d017ec6c4a79ea33cbe9dbfba\``);
        await queryRunner.query(`ALTER TABLE \`invoices\` DROP FOREIGN KEY \`FK_bdd2641a063181d0c3fde79a61f\``);
        await queryRunner.query(`ALTER TABLE \`invoices\` DROP FOREIGN KEY \`FK_152988a3fbcfc5428f772409da8\``);
        await queryRunner.query(`ALTER TABLE \`invoices\` DROP FOREIGN KEY \`FK_fcbe490dc37a1abf68f19c5ccb9\``);
        await queryRunner.query(`ALTER TABLE \`contracts\` DROP FOREIGN KEY \`FK_ae7391ff0623c3cfb9c98602726\``);
        await queryRunner.query(`ALTER TABLE \`contracts\` DROP FOREIGN KEY \`FK_daba0382e0de7a0293174d8f45b\``);
        await queryRunner.query(`ALTER TABLE \`contracts\` DROP FOREIGN KEY \`FK_4f178b72ba6f1e74f6643d86c11\``);
        await queryRunner.query(`ALTER TABLE \`contacts\` DROP FOREIGN KEY \`FK_30ef77942fc8c05fcb829dcc61d\``);
        await queryRunner.query(`ALTER TABLE \`tags\` DROP FOREIGN KEY \`FK_92e67dc508c705dd66c94615576\``);
        await queryRunner.query(`ALTER TABLE \`wallets\` DROP FOREIGN KEY \`FK_2ecdb33f23e9a6fc392025c0b97\``);
        await queryRunner.query(`ALTER TABLE \`sessions\` DROP FOREIGN KEY \`FK_57de40bc620f456c7311aa3a1e6\``);
        await queryRunner.query(`DROP INDEX \`IDX_baa8a5aceb11d30d2e8051321f\` ON \`transactions_tags\``);
        await queryRunner.query(`DROP INDEX \`IDX_b43f29533801ade11b6fb79bc8\` ON \`transactions_tags\``);
        await queryRunner.query(`DROP TABLE \`transactions_tags\``);
        await queryRunner.query(`DROP INDEX \`IDX_627248d810e0d04f78631a320c\` ON \`invoice_tags\``);
        await queryRunner.query(`DROP INDEX \`IDX_f053a74b5048bd7545f64084a1\` ON \`invoice_tags\``);
        await queryRunner.query(`DROP TABLE \`invoice_tags\``);
        await queryRunner.query(`DROP INDEX \`IDX_e841a065d532c259d24829a50b\` ON \`contract_tags\``);
        await queryRunner.query(`DROP INDEX \`IDX_841a957ac3be3bfa78b4a1ec90\` ON \`contract_tags\``);
        await queryRunner.query(`DROP TABLE \`contract_tags\``);
        await queryRunner.query(`DROP TABLE \`wallet_snapshots\``);
        await queryRunner.query(`DROP INDEX \`IDX_3d454294cc51b7a716ab26464b\` ON \`transactions\``);
        await queryRunner.query(`DROP TABLE \`transactions\``);
        await queryRunner.query(`DROP TABLE \`invoices\``);
        await queryRunner.query(`DROP TABLE \`contracts\``);
        await queryRunner.query(`DROP TABLE \`contacts\``);
        await queryRunner.query(`DROP TABLE \`tags\``);
        await queryRunner.query(`DROP TABLE \`wallets\``);
        await queryRunner.query(`DROP TABLE \`sessions\``);
        await queryRunner.query(`DROP INDEX \`IDX_a4bfb41ec19ba07b20d6e1ed02\` ON \`users\``);
        await queryRunner.query(`DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\``);
        await queryRunner.query(`DROP INDEX \`IDX_fe0bb3f6520ee0469504521e71\` ON \`users\``);
        await queryRunner.query(`DROP TABLE \`users\``);
    }

}
