import { getOperationLog } from '@/api/db';
import MyIcon from '@/components/Icon';
import { DBDetailType, OpsRequestItemType } from '@/types/db';
import { I18nCommonKey } from '@/types/i18next';
import { RequiredByKeys } from '@/utils/tools';
import {
  Box,
  Divider,
  Flex,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useTranslation } from 'next-i18next';
import { Fragment } from 'react';

export default function OperationLog({ db }: { db?: DBDetailType }) {
  const { t } = useTranslation();

  const { data: operationList = [], isSuccess } = useQuery(
    ['getOperationLog', db?.dbName, db?.dbType],
    async () => {
      if (!db?.dbName || !db?.dbType) return [];
      const operationList = await getOperationLog({
        name: db.dbName,
        dbType: db.dbType
      });
      operationList.sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
      return operationList as RequiredByKeys<OpsRequestItemType, 'configurations'>[];
    },
    {
      enabled: !!db?.dbName,
      refetchInterval: 5000
    }
  );

  const historyColumns: {
    title: I18nCommonKey;
    dataIndex?: keyof OpsRequestItemType;
    key: string;
    render?: (
      item: RequiredByKeys<OpsRequestItemType, 'configurations'>,
      configIndex: number
    ) => React.ReactNode | string;
  }[] = [
    {
      title: 'dbconfig.modify_time',
      key: 'creation_time',
      render: (item, configIndex) => (
        <Box>{configIndex === 0 ? dayjs(item.startTime).format('YYYY-MM-DD HH:mm') : ''}</Box>
      )
    },
    {
      title: 'name',
      key: 'name',
      render: (item, configIndex) => (
        <Box>{t(item.configurations[configIndex].parameterName as I18nCommonKey)}</Box>
      )
    },
    {
      title: 'dbconfig.original_value',
      key: 'original_value',
      render: (item, configIndex) => (
        <Box color={'grayModern.600'}>{item.configurations[configIndex].oldValue}</Box>
      )
    },
    {
      title: 'dbconfig.modified_value',
      key: 'modified_value',
      render: (item, configIndex) => (
        <Box color={'grayModern.600'}>{item.configurations[configIndex].newValue}</Box>
      )
    },
    {
      title: 'status',
      key: 'status',
      render: (item, configIndex) => (
        <Flex color={item.status.color} alignItems={'center'}>
          {configIndex === 0 ? t(item.status.label) : ''}
        </Flex>
      )
    }
  ];

  if (isSuccess && operationList?.length === 0) {
    return (
      <Flex
        h={'100%'}
        justifyContent={'center'}
        alignItems={'center'}
        flexDirection={'column'}
        flex={1}
      >
        <MyIcon name={'noEvents'} color={'transparent'} width={'36px'} height={'36px'} />
        <Box pt={'8px'}>{t('no_data_available')}</Box>
      </Flex>
    );
  }

  return (
    <Flex flexDirection={'column'} h={'full'} w={'full'} position={'relative'}>
      <Flex justifyContent={'space-between'} alignItems={'center'} mb={'16px'}>
        <Box
          pb={'6px'}
          pt={'4px'}
          borderBottom={'2px solid'}
          fontSize={'16px'}
          fontWeight={500}
          color={'grayModern.900'}
        >
          {t('change_log')}
        </Box>
      </Flex>

      <TableContainer h={'100%'} overflowY={'auto'} position={'relative'}>
        <Table variant={'unstyled'} backgroundColor={'white'}>
          <Thead position="sticky" top={0} zIndex={1}>
            <Tr>
              {historyColumns.map((item) => (
                <Th
                  fontSize={'12px'}
                  py={4}
                  key={item.key}
                  border={'none'}
                  backgroundColor={'grayModern.50'}
                  fontWeight={'500'}
                  color={'grayModern.600'}
                >
                  {t(item.title)}
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {operationList?.map((app, appIndex) => {
              return (
                <Fragment key={app.id}>
                  {app.configurations?.map((item, configIndex) => {
                    return (
                      <Tr key={item.parameterName + configIndex}>
                        {historyColumns.map((col) => (
                          <Td key={col.key} h={'48px'}>
                            {col.render
                              ? col.render(app, configIndex)
                              : col.dataIndex
                              ? `${app[col.dataIndex]}`
                              : '-'}
                          </Td>
                        ))}
                      </Tr>
                    );
                  })}
                  {appIndex < operationList.length - 1 && (
                    <Tr>
                      <Td colSpan={historyColumns.length} p={0}>
                        <Divider my={'2px'} bg="grayModern.200" />
                      </Td>
                    </Tr>
                  )}
                </Fragment>
              );
            })}
          </Tbody>
        </Table>
      </TableContainer>
    </Flex>
  );
}
